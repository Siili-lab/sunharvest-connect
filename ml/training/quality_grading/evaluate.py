"""
Model Evaluation Script

Evaluates the trained quality grading model on test data.
Generates confusion matrix, classification report, and per-crop analysis.

Also includes bias evaluation framework for NIRU AI Hackathon compliance.
"""

import tensorflow as tf
import numpy as np
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Try to import optional dependencies
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

try:
    from sklearn.metrics import confusion_matrix, classification_report
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

# Configuration
CONFIG = {
    'image_size': (224, 224),
    'batch_size': 32,
    'class_names': ['premium', 'grade_a', 'grade_b', 'reject'],
    'data_dir': str(Path(__file__).parent.parent.parent / 'data' / 'unified_quality'),
    'model_dir': str(Path(__file__).parent.parent.parent / 'models' / 'quality_grading'),
}


def load_latest_model():
    """Load the most recent trained model."""
    model_dir = Path(CONFIG['model_dir'])

    # Try to find latest model
    h5_files = list(model_dir.glob('final_model_*.h5'))
    if not h5_files:
        h5_files = list(model_dir.glob('*.h5'))

    if not h5_files:
        raise FileNotFoundError(f"No model found in {model_dir}")

    # Sort by modification time, get newest
    latest = max(h5_files, key=lambda p: p.stat().st_mtime)
    print(f"Loading model: {latest}")

    return tf.keras.models.load_model(str(latest)), latest.stem


def create_test_generator():
    """Create test data generator."""
    from tensorflow.keras.preprocessing.image import ImageDataGenerator

    test_datagen = ImageDataGenerator(rescale=1./255)

    test_dir = Path(CONFIG['data_dir']) / 'test'
    if not test_dir.exists():
        raise FileNotFoundError(f"Test data not found at {test_dir}")

    test_generator = test_datagen.flow_from_directory(
        test_dir,
        target_size=CONFIG['image_size'],
        batch_size=CONFIG['batch_size'],
        class_mode='categorical',
        classes=CONFIG['class_names'],
        shuffle=False
    )

    return test_generator


def evaluate_model(model, test_gen):
    """Run full evaluation on test set."""
    print("\n" + "=" * 60)
    print("MODEL EVALUATION")
    print("=" * 60)

    # Basic metrics
    print("\n1. Computing metrics...")
    results = model.evaluate(test_gen, verbose=1)

    metrics = {
        'loss': results[0],
        'accuracy': results[1],
    }
    if len(results) > 2:
        metrics['precision'] = results[2]
        metrics['recall'] = results[3]

    print(f"\n   Loss: {metrics['loss']:.4f}")
    print(f"   Accuracy: {metrics['accuracy']:.4f}")
    if 'precision' in metrics:
        print(f"   Precision: {metrics['precision']:.4f}")
        print(f"   Recall: {metrics['recall']:.4f}")

    # Get predictions for confusion matrix
    print("\n2. Generating predictions...")
    test_gen.reset()
    predictions = model.predict(test_gen, verbose=1)
    predicted_classes = np.argmax(predictions, axis=1)
    true_classes = test_gen.classes

    return metrics, predicted_classes, true_classes, predictions


def compute_confusion_matrix(true_classes, predicted_classes, class_names):
    """Compute and display confusion matrix."""
    print("\n3. Confusion Matrix:")

    if HAS_SKLEARN:
        cm = confusion_matrix(true_classes, predicted_classes)
        report = classification_report(true_classes, predicted_classes,
                                       target_names=class_names, digits=4)
    else:
        # Simple confusion matrix without sklearn
        n_classes = len(class_names)
        cm = np.zeros((n_classes, n_classes), dtype=int)
        for t, p in zip(true_classes, predicted_classes):
            cm[t, p] += 1
        report = "sklearn not installed - classification report unavailable"

    # Print as text
    print("\n" + " " * 12 + "  ".join([f"{n:>8}" for n in class_names]))
    for i, row in enumerate(cm):
        print(f"{class_names[i]:>10}: " + "  ".join([f"{v:>8}" for v in row]))

    # Classification report
    print("\n4. Classification Report:")
    print(report)

    return cm, report


def plot_confusion_matrix(cm, class_names, output_path):
    """Save confusion matrix as image."""
    if not HAS_MATPLOTLIB:
        print("matplotlib not installed - skipping confusion matrix plot")
        return

    fig, ax = plt.subplots(figsize=(10, 8))

    im = ax.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)

    ax.set(xticks=np.arange(cm.shape[1]),
           yticks=np.arange(cm.shape[0]),
           xticklabels=class_names,
           yticklabels=class_names,
           title='Confusion Matrix',
           ylabel='True Grade',
           xlabel='Predicted Grade')

    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")

    # Add text annotations
    thresh = cm.max() / 2.
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, format(cm[i, j], 'd'),
                    ha="center", va="center",
                    color="white" if cm[i, j] > thresh else "black")

    fig.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()
    print(f"\nConfusion matrix saved to: {output_path}")


def analyze_per_crop_performance(test_gen, predicted_classes, true_classes):
    """Analyze model performance per crop type."""
    print("\n5. Per-Crop Analysis:")

    # Extract crop name from filenames
    filenames = test_gen.filenames
    crop_results = defaultdict(lambda: {'correct': 0, 'total': 0})

    for i, filename in enumerate(filenames):
        # Filename format: crop_grade_split_00000.jpg
        parts = Path(filename).stem.split('_')
        if len(parts) >= 1:
            crop = parts[0]
            crop_results[crop]['total'] += 1
            if predicted_classes[i] == true_classes[i]:
                crop_results[crop]['correct'] += 1

    print("\n   Crop          Accuracy    Samples")
    print("   " + "-" * 40)
    for crop, stats in sorted(crop_results.items()):
        acc = stats['correct'] / stats['total'] if stats['total'] > 0 else 0
        print(f"   {crop:<12}   {acc:>6.1%}      {stats['total']:>5}")

    return dict(crop_results)


def analyze_grade_confusion(cm, class_names):
    """Analyze which grades are most confused."""
    print("\n6. Grade Confusion Analysis:")

    # Most common misclassifications
    misclass = []
    for i in range(len(class_names)):
        for j in range(len(class_names)):
            if i != j and cm[i, j] > 0:
                misclass.append((class_names[i], class_names[j], cm[i, j]))

    misclass.sort(key=lambda x: x[2], reverse=True)

    print("\n   Most common misclassifications:")
    for true, pred, count in misclass[:5]:
        print(f"   {true} -> {pred}: {count} samples")


def save_evaluation_report(metrics, cm, crop_results, model_name, output_dir):
    """Save full evaluation report as JSON."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    report = {
        'timestamp': timestamp,
        'model': model_name,
        'metrics': {k: float(v) for k, v in metrics.items()},
        'confusion_matrix': cm.tolist() if hasattr(cm, 'tolist') else cm,
        'class_names': CONFIG['class_names'],
        'per_crop_accuracy': {
            crop: stats['correct'] / stats['total'] if stats['total'] > 0 else 0
            for crop, stats in crop_results.items()
        },
        'per_crop_samples': {
            crop: stats['total']
            for crop, stats in crop_results.items()
        }
    }

    report_path = output_dir / f'evaluation_report_{timestamp}.json'
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"\nEvaluation report saved to: {report_path}")
    return report


def main():
    """Main evaluation entry point."""
    print("=" * 60)
    print("QUALITY GRADING MODEL EVALUATION")
    print("=" * 60)

    # Load model
    model, model_name = load_latest_model()

    # Create test generator
    test_gen = create_test_generator()
    print(f"Test samples: {test_gen.samples}")

    # Run evaluation
    metrics, predicted_classes, true_classes, predictions = evaluate_model(model, test_gen)

    # Confusion matrix
    cm, report = compute_confusion_matrix(true_classes, predicted_classes, CONFIG['class_names'])

    # Save confusion matrix plot
    output_dir = Path(CONFIG['model_dir'])
    plot_confusion_matrix(cm, CONFIG['class_names'],
                          output_dir / 'confusion_matrix.png')

    # Per-crop analysis
    crop_results = analyze_per_crop_performance(test_gen, predicted_classes, true_classes)

    # Grade confusion analysis
    analyze_grade_confusion(cm, CONFIG['class_names'])

    # Save report
    save_evaluation_report(metrics, cm, crop_results, model_name, output_dir)

    print("\n" + "=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)


if __name__ == '__main__':
    main()
