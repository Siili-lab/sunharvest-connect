"""
Bias & Fairness Testing for Quality Grading Model

Tests the model for systematic biases across:
1. Crop types - Does the model grade some crops more harshly?
2. Grade distribution - Are error rates balanced across grades?
3. Misclassification patterns - Which crop-grade combos are most confused?
4. Disparate impact - Do certain crops get disproportionately rejected?

Run: python ml/training/quality_grading/bias_test.py
"""

import tensorflow as tf
import numpy as np
import json
from pathlib import Path
from collections import defaultdict
from datetime import datetime

try:
    from sklearn.metrics import confusion_matrix, classification_report
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

# Configuration
CONFIG = {
    'image_size': (224, 224),
    'batch_size': 32,
    'class_names': ['grade_a', 'grade_b', 'premium', 'reject'],
    'data_dir': str(Path(__file__).parent.parent.parent / 'data' / 'unified_quality'),
    'model_dir': str(Path(__file__).parent.parent.parent / 'models' / 'quality_grading'),
}

GRADE_LABELS = {
    'premium': 'Premium',
    'grade_a': 'Grade A',
    'grade_b': 'Grade B',
    'reject': 'Reject',
}

# Thresholds for bias flags
DISPARATE_IMPACT_THRESHOLD = 0.8  # 4/5ths rule
ACCURACY_GAP_THRESHOLD = 0.15     # >15% accuracy gap flags a bias concern
FPR_GAP_THRESHOLD = 0.10          # >10% FPR gap flags a concern


def load_model():
    model_dir = Path(CONFIG['model_dir'])
    model_files = list(model_dir.glob('finetuned_model_*.keras'))
    if not model_files:
        model_files = list(model_dir.glob('final_model_*.keras'))
    if not model_files:
        model_files = list(model_dir.glob('*.keras')) + list(model_dir.glob('*.h5'))
    if not model_files:
        raise FileNotFoundError(f"No model found in {model_dir}")
    latest = max(model_files, key=lambda p: p.stat().st_mtime)
    print(f"Loading model: {latest.name}")
    return tf.keras.models.load_model(str(latest))


def create_test_dataset():
    test_dir = Path(CONFIG['data_dir']) / 'test'
    if not test_dir.exists():
        raise FileNotFoundError(f"Test data not found at {test_dir}")
    test_ds = tf.keras.utils.image_dataset_from_directory(
        test_dir,
        image_size=CONFIG['image_size'],
        batch_size=CONFIG['batch_size'],
        label_mode='categorical',
        shuffle=False,
    )
    CONFIG['class_names'] = test_ds.class_names
    return test_ds


def extract_crop_from_filename(filepath):
    """Extract crop name from filename like 'tomato_grade_a_test_00001.jpg'."""
    stem = Path(filepath).stem
    parts = stem.split('_')
    if len(parts) >= 1:
        return parts[0].lower()
    return 'unknown'


def get_predictions(model, test_ds):
    """Get predictions, true labels, confidences, and file paths."""
    all_labels = []
    all_preds = []

    for images, labels in test_ds:
        preds = model.predict(images, verbose=0)
        all_labels.append(labels.numpy())
        all_preds.append(preds)

    all_labels = np.concatenate(all_labels, axis=0)
    all_preds = np.concatenate(all_preds, axis=0)

    true_classes = np.argmax(all_labels, axis=1)
    pred_classes = np.argmax(all_preds, axis=1)
    confidences = np.max(all_preds, axis=1)
    file_paths = test_ds.file_paths

    return true_classes, pred_classes, confidences, all_preds, file_paths


def test_crop_accuracy_parity(true_classes, pred_classes, file_paths, class_names):
    """Test 1: Are accuracy rates similar across crops?"""
    print("\n" + "=" * 60)
    print("TEST 1: CROP ACCURACY PARITY")
    print("=" * 60)

    crop_stats = defaultdict(lambda: {'correct': 0, 'total': 0, 'per_grade': defaultdict(lambda: {'correct': 0, 'total': 0})})

    for i, fp in enumerate(file_paths):
        crop = extract_crop_from_filename(fp)
        true_grade = class_names[true_classes[i]]
        crop_stats[crop]['total'] += 1
        crop_stats[crop]['per_grade'][true_grade]['total'] += 1
        if pred_classes[i] == true_classes[i]:
            crop_stats[crop]['correct'] += 1
            crop_stats[crop]['per_grade'][true_grade]['correct'] += 1

    # Compute accuracy per crop
    crop_acc = {}
    for crop, stats in sorted(crop_stats.items()):
        if stats['total'] >= 5:  # Only crops with enough samples
            acc = stats['correct'] / stats['total']
            crop_acc[crop] = acc

    if not crop_acc:
        print("  Not enough crop-level data for analysis.")
        return {}, []

    avg_acc = sum(crop_acc.values()) / len(crop_acc)
    max_acc = max(crop_acc.values())
    min_acc = min(crop_acc.values())
    gap = max_acc - min_acc

    print(f"\n  {'Crop':<14} {'Accuracy':>10} {'Samples':>10}  {'Status'}")
    print("  " + "-" * 50)

    flags = []
    for crop in sorted(crop_acc, key=crop_acc.get):
        acc = crop_acc[crop]
        total = crop_stats[crop]['total']
        status = "BIAS FLAG" if acc < avg_acc - ACCURACY_GAP_THRESHOLD else "OK"
        if status == "BIAS FLAG":
            flags.append(f"{crop} accuracy ({acc:.1%}) is {avg_acc - acc:.1%} below average ({avg_acc:.1%})")
        print(f"  {crop:<14} {acc:>9.1%} {total:>10}  {status}")

    print(f"\n  Average accuracy: {avg_acc:.1%}")
    print(f"  Accuracy gap (max - min): {gap:.1%}")
    print(f"  Threshold: {ACCURACY_GAP_THRESHOLD:.0%}")
    print(f"  Result: {'PASS' if gap <= ACCURACY_GAP_THRESHOLD else 'BIAS CONCERN - accuracy gap exceeds threshold'}")

    return crop_acc, flags


def test_reject_rate_parity(true_classes, pred_classes, file_paths, class_names):
    """Test 2: Disparate impact - are some crops rejected more often?"""
    print("\n" + "=" * 60)
    print("TEST 2: REJECT RATE PARITY (DISPARATE IMPACT)")
    print("=" * 60)

    reject_idx = class_names.index('reject') if 'reject' in class_names else -1
    if reject_idx == -1:
        print("  No 'reject' class found. Skipping.")
        return {}, []

    crop_reject = defaultdict(lambda: {'rejected': 0, 'total': 0})

    for i, fp in enumerate(file_paths):
        crop = extract_crop_from_filename(fp)
        crop_reject[crop]['total'] += 1
        if pred_classes[i] == reject_idx:
            crop_reject[crop]['rejected'] += 1

    crop_reject_rate = {}
    for crop, stats in crop_reject.items():
        if stats['total'] >= 5:
            crop_reject_rate[crop] = stats['rejected'] / stats['total']

    if not crop_reject_rate:
        print("  Not enough data.")
        return {}, []

    avg_reject = sum(crop_reject_rate.values()) / len(crop_reject_rate)
    min_reject = min(crop_reject_rate.values())
    max_reject = max(crop_reject_rate.values())

    print(f"\n  {'Crop':<14} {'Reject Rate':>12} {'Samples':>10}  {'Status'}")
    print("  " + "-" * 55)

    flags = []
    for crop in sorted(crop_reject_rate, key=crop_reject_rate.get, reverse=True):
        rate = crop_reject_rate[crop]
        total = crop_reject[crop]['total']
        # Disparate impact: if any crop's reject rate is 2x the average, flag it
        ratio = rate / avg_reject if avg_reject > 0 else 1.0
        status = "BIAS FLAG" if ratio > 2.0 and total >= 10 else "OK"
        if status == "BIAS FLAG":
            flags.append(f"{crop} reject rate ({rate:.1%}) is {ratio:.1f}x the average ({avg_reject:.1%})")
        print(f"  {crop:<14} {rate:>11.1%} {total:>10}  {status}")

    print(f"\n  Average reject rate: {avg_reject:.1%}")

    # 4/5ths rule check on acceptance (inverse of rejection)
    if max_reject > 0 and min_reject >= 0:
        acceptance_rates = {c: 1 - r for c, r in crop_reject_rate.items()}
        max_acceptance = max(acceptance_rates.values())
        di_violations = []
        for crop, acc_rate in acceptance_rates.items():
            if max_acceptance > 0:
                ratio = acc_rate / max_acceptance
                if ratio < DISPARATE_IMPACT_THRESHOLD:
                    di_violations.append(f"{crop} (ratio={ratio:.2f})")

        if di_violations:
            print(f"\n  4/5ths Rule Violations: {', '.join(di_violations)}")
            flags.extend([f"4/5ths rule violation for {v}" for v in di_violations])
        else:
            print(f"\n  4/5ths Rule: PASS (all crops within acceptable range)")

    return crop_reject_rate, flags


def test_false_positive_rate_parity(true_classes, pred_classes, file_paths, class_names):
    """Test 3: Are false positive rates similar across grades per crop?"""
    print("\n" + "=" * 60)
    print("TEST 3: FALSE POSITIVE RATE PARITY")
    print("=" * 60)

    flags = []
    grade_fpr = {}

    for grade_idx, grade_name in enumerate(class_names):
        # FPR = false positives / (false positives + true negatives)
        fp = sum(1 for i in range(len(true_classes))
                 if pred_classes[i] == grade_idx and true_classes[i] != grade_idx)
        tn = sum(1 for i in range(len(true_classes))
                 if pred_classes[i] != grade_idx and true_classes[i] != grade_idx)
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        grade_fpr[grade_name] = fpr

    print(f"\n  {'Grade':<14} {'FPR':>10}")
    print("  " + "-" * 30)
    for grade, fpr in sorted(grade_fpr.items(), key=lambda x: x[1], reverse=True):
        print(f"  {GRADE_LABELS.get(grade, grade):<14} {fpr:>9.2%}")

    max_fpr = max(grade_fpr.values())
    min_fpr = min(grade_fpr.values())
    gap = max_fpr - min_fpr

    print(f"\n  FPR gap: {gap:.2%}")
    print(f"  Threshold: {FPR_GAP_THRESHOLD:.0%}")

    if gap > FPR_GAP_THRESHOLD:
        worst = max(grade_fpr, key=grade_fpr.get)
        flags.append(f"FPR gap ({gap:.1%}) exceeds threshold. Worst: {worst} at {grade_fpr[worst]:.1%}")
        print(f"  Result: BIAS CONCERN")
    else:
        print(f"  Result: PASS")

    return grade_fpr, flags


def test_confidence_distribution(pred_classes, confidences, file_paths, class_names):
    """Test 4: Are confidence levels systematically lower for some crops?"""
    print("\n" + "=" * 60)
    print("TEST 4: CONFIDENCE DISTRIBUTION BY CROP")
    print("=" * 60)

    crop_conf = defaultdict(list)
    for i, fp in enumerate(file_paths):
        crop = extract_crop_from_filename(fp)
        crop_conf[crop].append(confidences[i])

    print(f"\n  {'Crop':<14} {'Mean Conf':>10} {'Std':>8} {'Min':>8} {'Samples':>10}")
    print("  " + "-" * 55)

    flags = []
    avg_confs = {}
    for crop in sorted(crop_conf):
        confs = crop_conf[crop]
        if len(confs) >= 5:
            mean_c = np.mean(confs)
            std_c = np.std(confs)
            min_c = np.min(confs)
            avg_confs[crop] = mean_c
            print(f"  {crop:<14} {mean_c:>9.1%} {std_c:>7.1%} {min_c:>7.1%} {len(confs):>10}")

    if avg_confs:
        overall_mean = np.mean(list(avg_confs.values()))
        for crop, mean_c in avg_confs.items():
            if mean_c < overall_mean - 0.15:
                flags.append(f"{crop} mean confidence ({mean_c:.1%}) significantly below average ({overall_mean:.1%})")

    return avg_confs, flags


def test_misclassification_patterns(true_classes, pred_classes, file_paths, class_names):
    """Test 5: Which crop-grade combinations are most frequently misclassified?"""
    print("\n" + "=" * 60)
    print("TEST 5: MISCLASSIFICATION PATTERNS")
    print("=" * 60)

    misclass = defaultdict(int)
    total_by_combo = defaultdict(int)

    for i, fp in enumerate(file_paths):
        crop = extract_crop_from_filename(fp)
        true_grade = class_names[true_classes[i]]
        pred_grade = class_names[pred_classes[i]]
        total_by_combo[(crop, true_grade)] += 1
        if true_grade != pred_grade:
            misclass[(crop, true_grade, pred_grade)] += 1

    # Sort by count
    sorted_misclass = sorted(misclass.items(), key=lambda x: x[1], reverse=True)

    print(f"\n  Top 10 misclassification patterns:")
    print(f"  {'Crop':<12} {'True Grade':<12} {'Pred Grade':<12} {'Count':>6} {'Rate':>8}")
    print("  " + "-" * 55)

    flags = []
    for (crop, true_g, pred_g), count in sorted_misclass[:10]:
        total = total_by_combo[(crop, true_g)]
        rate = count / total if total > 0 else 0
        label = f"{GRADE_LABELS.get(true_g, true_g)} -> {GRADE_LABELS.get(pred_g, pred_g)}"
        print(f"  {crop:<12} {GRADE_LABELS.get(true_g, true_g):<12} {GRADE_LABELS.get(pred_g, pred_g):<12} {count:>6} {rate:>7.1%}")
        if rate > 0.5 and total >= 5:
            flags.append(f"{crop} {label}: {rate:.0%} misclass rate ({count}/{total})")

    return dict(misclass), flags


def generate_report(all_flags, crop_acc, reject_rates, grade_fpr, crop_conf):
    """Generate final bias testing report."""
    print("\n" + "=" * 60)
    print("BIAS TESTING REPORT SUMMARY")
    print("=" * 60)

    total_flags = len(all_flags)

    if total_flags == 0:
        print("\n  RESULT: PASS - No significant bias detected")
        print("  The model shows acceptable fairness across crop types and grades.")
    else:
        print(f"\n  RESULT: {total_flags} BIAS CONCERN(S) DETECTED")
        print("\n  Issues found:")
        for i, flag in enumerate(all_flags, 1):
            print(f"    {i}. {flag}")

    print("\n  Recommendations:")
    if total_flags == 0:
        print("    - Continue monitoring with production data")
        print("    - Re-run bias tests after model retraining")
    else:
        print("    - Review training data balance for flagged crops")
        print("    - Consider data augmentation for underperforming crops")
        print("    - Investigate systematic misclassification patterns")
        print("    - Apply fairness-aware training techniques if issues persist")

    # Save report
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report = {
        'timestamp': timestamp,
        'total_flags': total_flags,
        'flags': all_flags,
        'pass': total_flags == 0,
        'crop_accuracy': {k: float(v) for k, v in crop_acc.items()} if crop_acc else {},
        'reject_rates': {k: float(v) for k, v in reject_rates.items()} if reject_rates else {},
        'grade_fpr': {k: float(v) for k, v in grade_fpr.items()} if grade_fpr else {},
        'crop_confidence': {k: float(v) for k, v in crop_conf.items()} if crop_conf else {},
        'thresholds': {
            'disparate_impact': DISPARATE_IMPACT_THRESHOLD,
            'accuracy_gap': ACCURACY_GAP_THRESHOLD,
            'fpr_gap': FPR_GAP_THRESHOLD,
        },
    }

    report_path = Path(CONFIG['model_dir']) / f'bias_report_{timestamp}.json'
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\n  Report saved: {report_path}")

    return report


def main():
    print("=" * 60)
    print("BIAS & FAIRNESS TESTING")
    print("Quality Grading Model - SunHarvest Connect")
    print("=" * 60)

    model = load_model()
    test_ds = create_test_dataset()

    print(f"\nClasses: {CONFIG['class_names']}")
    total = sum(1 for _ in Path(CONFIG['data_dir'], 'test').rglob("*") if _.is_file())
    print(f"Test samples: {total}")

    print("\nRunning predictions...")
    true_classes, pred_classes, confidences, all_preds, file_paths = get_predictions(model, test_ds)

    all_flags = []

    crop_acc, flags = test_crop_accuracy_parity(true_classes, pred_classes, file_paths, CONFIG['class_names'])
    all_flags.extend(flags)

    reject_rates, flags = test_reject_rate_parity(true_classes, pred_classes, file_paths, CONFIG['class_names'])
    all_flags.extend(flags)

    grade_fpr, flags = test_false_positive_rate_parity(true_classes, pred_classes, file_paths, CONFIG['class_names'])
    all_flags.extend(flags)

    crop_conf, flags = test_confidence_distribution(pred_classes, confidences, file_paths, CONFIG['class_names'])
    all_flags.extend(flags)

    _, flags = test_misclassification_patterns(true_classes, pred_classes, file_paths, CONFIG['class_names'])
    all_flags.extend(flags)

    report = generate_report(all_flags, crop_acc, reject_rates, grade_fpr, crop_conf)

    print("\n" + "=" * 60)
    print("BIAS TESTING COMPLETE")
    print("=" * 60)

    return report


if __name__ == '__main__':
    main()
