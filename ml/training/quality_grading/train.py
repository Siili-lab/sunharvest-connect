"""
Quality Grading Model Training Pipeline

Trains a MobileNetV2-based classifier for produce quality grading.
Optimized for mobile deployment with TensorFlow Lite.

Supports 4 quality grades:
- Premium: Best quality, peak ripeness
- Grade A: Good quality, sellable
- Grade B: Acceptable, some degradation
- Reject: Unsellable, damaged/rotten

Usage:
    1. Run prepare_data.py first to unify datasets
    2. Run this script: python train.py
"""

import tensorflow as tf
import os
import json
import numpy as np
from pathlib import Path
from datetime import datetime
from collections import Counter

# Configuration
CONFIG = {
    'image_size': (224, 224),
    'batch_size': 32,
    'epochs': 50,
    'fine_tune_epochs': 20,
    'learning_rate': 0.001,
    'fine_tune_lr': 0.0001,
    'num_classes': 4,
    'class_names': ['grade_a', 'grade_b', 'premium', 'reject'],
    'data_dir': str(Path(__file__).parent.parent.parent / 'data' / 'unified_quality'),
    'model_dir': str(Path(__file__).parent.parent.parent / 'models' / 'quality_grading'),
}


def create_model(num_classes: int):
    """
    Create MobileNetV2 model with custom classification head.
    Uses transfer learning from ImageNet weights.
    """
    base_model = tf.keras.applications.MobileNetV2(
        weights='imagenet',
        include_top=False,
        input_shape=(*CONFIG['image_size'], 3)
    )

    # Freeze base model layers initially
    base_model.trainable = False

    # Custom classification head
    inputs = tf.keras.Input(shape=(*CONFIG['image_size'], 3))
    x = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dense(256, activation='relu')(x)
    x = tf.keras.layers.Dropout(0.5)(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dense(128, activation='relu')(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation='softmax')(x)

    model = tf.keras.Model(inputs=inputs, outputs=outputs)
    return model, base_model


# Data augmentation layer for training
data_augmentation = tf.keras.Sequential([
    tf.keras.layers.RandomFlip("horizontal_and_vertical"),
    tf.keras.layers.RandomRotation(0.08),  # ~30 degrees
    tf.keras.layers.RandomZoom(0.2),
    tf.keras.layers.RandomBrightness(0.2),
    tf.keras.layers.RandomContrast(0.2),
])


def load_datasets():
    """Load training, validation, and test datasets using tf.data."""
    train_dir = Path(CONFIG['data_dir']) / 'train'
    val_dir = Path(CONFIG['data_dir']) / 'val'
    test_dir = Path(CONFIG['data_dir']) / 'test'

    if not train_dir.exists():
        raise FileNotFoundError(
            f"Training data not found at {train_dir}. "
            "Run prepare_data.py first to create the unified dataset."
        )

    train_ds = tf.keras.utils.image_dataset_from_directory(
        train_dir,
        image_size=CONFIG['image_size'],
        batch_size=CONFIG['batch_size'],
        label_mode='categorical',
        shuffle=True,
        seed=42,
    )

    val_ds = tf.keras.utils.image_dataset_from_directory(
        val_dir,
        image_size=CONFIG['image_size'],
        batch_size=CONFIG['batch_size'],
        label_mode='categorical',
        shuffle=False,
    )

    test_ds = None
    if test_dir.exists():
        test_ds = tf.keras.utils.image_dataset_from_directory(
            test_dir,
            image_size=CONFIG['image_size'],
            batch_size=CONFIG['batch_size'],
            label_mode='categorical',
            shuffle=False,
        )

    # Print discovered class names (alphabetical order from directory names)
    print(f"   Class names: {train_ds.class_names}")
    CONFIG['class_names'] = train_ds.class_names

    return train_ds, val_ds, test_ds


def compute_class_weights(train_dir):
    """Compute class weights to handle imbalanced data."""
    class_counts = {}
    for grade_dir in sorted(Path(train_dir).iterdir()):
        if grade_dir.is_dir():
            count = len(list(grade_dir.glob("*")))
            class_counts[grade_dir.name] = count

    total = sum(class_counts.values())
    num_classes = len(class_counts)

    # Map to indices (alphabetical order matches image_dataset_from_directory)
    sorted_names = sorted(class_counts.keys())
    class_weights = {}
    for idx, name in enumerate(sorted_names):
        class_weights[idx] = total / (num_classes * class_counts[name])

    print("Class distribution:", class_counts)
    print("Class weights:", class_weights)
    return class_weights


def prepare_datasets(train_ds, val_ds, test_ds):
    """Apply augmentation to training set and optimize all datasets."""
    AUTOTUNE = tf.data.AUTOTUNE

    # Apply augmentation only to training data
    train_ds = train_ds.map(
        lambda x, y: (data_augmentation(x, training=True), y),
        num_parallel_calls=AUTOTUNE
    )

    # Prefetch for performance
    train_ds = train_ds.prefetch(buffer_size=AUTOTUNE)
    val_ds = val_ds.prefetch(buffer_size=AUTOTUNE)
    if test_ds:
        test_ds = test_ds.prefetch(buffer_size=AUTOTUNE)

    return train_ds, val_ds, test_ds


def train():
    """Main training function."""
    print("=" * 60)
    print("QUALITY GRADING MODEL TRAINING")
    print("=" * 60)

    # Create model directory
    model_dir = Path(CONFIG['model_dir'])
    model_dir.mkdir(parents=True, exist_ok=True)

    print("\n1. Creating model...")
    model, base_model = create_model(CONFIG['num_classes'])
    model.summary()

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=CONFIG['learning_rate']),
        loss='categorical_crossentropy',
        metrics=[
            'accuracy',
            tf.keras.metrics.Precision(name='precision'),
            tf.keras.metrics.Recall(name='recall')
        ]
    )

    print("\n2. Loading data...")
    train_ds, val_ds, test_ds = load_datasets()

    # Count samples
    train_count = sum(1 for _ in Path(CONFIG['data_dir'], 'train').rglob("*") if _.is_file())
    val_count = sum(1 for _ in Path(CONFIG['data_dir'], 'val').rglob("*") if _.is_file())
    print(f"   Training samples: {train_count}")
    print(f"   Validation samples: {val_count}")

    # Compute class weights for imbalanced data
    class_weights = compute_class_weights(Path(CONFIG['data_dir']) / 'train')

    # Apply augmentation and optimize
    train_ds, val_ds, test_ds = prepare_datasets(train_ds, val_ds, test_ds)

    # Callbacks
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    log_dir = Path(__file__).parent / 'logs' / timestamp
    log_dir.mkdir(parents=True, exist_ok=True)

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True,
            verbose=1
        ),
        tf.keras.callbacks.ModelCheckpoint(
            str(model_dir / f'best_model_{timestamp}.keras'),
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-6,
            verbose=1
        ),
        tf.keras.callbacks.TensorBoard(log_dir=str(log_dir))
    ]

    print("\n3. Phase 1: Training classification head...")
    history = model.fit(
        train_ds,
        epochs=CONFIG['epochs'],
        validation_data=val_ds,
        callbacks=callbacks,
        class_weight=class_weights
    )

    # Fine-tuning phase
    print("\n4. Phase 2: Fine-tuning...")
    base_model.trainable = True

    # Freeze early layers, train last 30 layers
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=CONFIG['fine_tune_lr']),
        loss='categorical_crossentropy',
        metrics=[
            'accuracy',
            tf.keras.metrics.Precision(name='precision'),
            tf.keras.metrics.Recall(name='recall')
        ]
    )

    fine_tune_callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True,
            verbose=1
        ),
        tf.keras.callbacks.ModelCheckpoint(
            str(model_dir / f'finetuned_model_{timestamp}.keras'),
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,
            min_lr=1e-7,
            verbose=1
        ),
    ]

    history_fine = model.fit(
        train_ds,
        epochs=CONFIG['fine_tune_epochs'],
        validation_data=val_ds,
        callbacks=fine_tune_callbacks,
        class_weight=class_weights
    )

    # Evaluate on test set
    if test_ds:
        print("\n5. Evaluating on test set...")
        results = model.evaluate(test_ds)
        print(f"   Test Loss: {results[0]:.4f}")
        print(f"   Test Accuracy: {results[1]:.4f}")
        print(f"   Test Precision: {results[2]:.4f}")
        print(f"   Test Recall: {results[3]:.4f}")

    # Save final model
    final_model_path = model_dir / f'final_model_{timestamp}.keras'
    model.save(str(final_model_path))
    print(f"\n6. Model saved to {final_model_path}")

    # Save training config and class names
    config_path = model_dir / f'config_{timestamp}.json'
    with open(config_path, 'w') as f:
        json.dump({
            'class_names': CONFIG['class_names'],
            'image_size': CONFIG['image_size'],
            'timestamp': timestamp,
            'training_samples': train_count,
            'validation_samples': val_count,
        }, f, indent=2)

    return model, timestamp


def convert_to_tflite(model_path: str, output_path: str):
    """Convert Keras model to TensorFlow Lite for mobile deployment."""
    print(f"\nConverting to TFLite: {model_path}")
    model = tf.keras.models.load_model(model_path)

    # Standard conversion with float16 quantization
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]

    tflite_model = converter.convert()

    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"TFLite model saved to {output_path}")
    print(f"Model size: {size_mb:.2f} MB")

    return output_path


def main():
    """Main entry point."""
    # Check if data exists
    data_dir = Path(CONFIG['data_dir'])
    if not data_dir.exists():
        print("ERROR: Unified dataset not found!")
        print("Please run prepare_data.py first:")
        print("    python prepare_data.py")
        return

    # Train model
    model, timestamp = train()

    # Convert to TFLite
    model_dir = Path(CONFIG['model_dir'])
    convert_to_tflite(
        str(model_dir / f'final_model_{timestamp}.keras'),
        str(model_dir / f'quality_grading_{timestamp}.tflite')
    )

    # Also save as 'latest' for easy access
    convert_to_tflite(
        str(model_dir / f'final_model_{timestamp}.keras'),
        str(model_dir / 'quality_grading_latest.tflite')
    )

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    print(f"Models saved to: {model_dir}")
    print("\nNext steps:")
    print("1. Run evaluate.py to test model performance")
    print("2. Copy quality_grading_latest.tflite to mobile app")


if __name__ == '__main__':
    main()
