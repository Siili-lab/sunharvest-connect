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
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout, BatchNormalization
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, TensorBoard, ReduceLROnPlateau
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import os
import json
from pathlib import Path
from datetime import datetime

# Configuration
CONFIG = {
    'image_size': (224, 224),
    'batch_size': 32,
    'epochs': 50,
    'fine_tune_epochs': 20,
    'learning_rate': 0.001,
    'fine_tune_lr': 0.0001,
    'num_classes': 4,
    'class_names': ['premium', 'grade_a', 'grade_b', 'reject'],
    'data_dir': str(Path(__file__).parent.parent.parent / 'data' / 'unified_quality'),
    'model_dir': str(Path(__file__).parent.parent.parent / 'models' / 'quality_grading'),
}


def create_model(num_classes: int) -> Model:
    """
    Create MobileNetV2 model with custom classification head.
    Uses transfer learning from ImageNet weights.
    """
    base_model = MobileNetV2(
        weights='imagenet',
        include_top=False,
        input_shape=(*CONFIG['image_size'], 3)
    )

    # Freeze base model layers initially
    base_model.trainable = False

    # Custom classification head with batch normalization
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = BatchNormalization()(x)
    x = Dense(256, activation='relu')(x)
    x = Dropout(0.5)(x)
    x = BatchNormalization()(x)
    x = Dense(128, activation='relu')(x)
    x = Dropout(0.3)(x)
    outputs = Dense(num_classes, activation='softmax')(x)

    model = Model(inputs=base_model.input, outputs=outputs)
    return model


def create_data_generators():
    """
    Create training, validation, and test data generators with augmentation.
    """
    # Training data augmentation
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=30,
        width_shift_range=0.2,
        height_shift_range=0.2,
        horizontal_flip=True,
        vertical_flip=True,
        brightness_range=[0.7, 1.3],
        zoom_range=0.2,
        shear_range=0.1,
        fill_mode='nearest'
    )

    # Validation/test - only rescale
    val_datagen = ImageDataGenerator(rescale=1./255)

    train_dir = Path(CONFIG['data_dir']) / 'train'
    val_dir = Path(CONFIG['data_dir']) / 'val'
    test_dir = Path(CONFIG['data_dir']) / 'test'

    if not train_dir.exists():
        raise FileNotFoundError(
            f"Training data not found at {train_dir}. "
            "Run prepare_data.py first to create the unified dataset."
        )

    train_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=CONFIG['image_size'],
        batch_size=CONFIG['batch_size'],
        class_mode='categorical',
        classes=CONFIG['class_names'],
        shuffle=True
    )

    val_generator = val_datagen.flow_from_directory(
        val_dir,
        target_size=CONFIG['image_size'],
        batch_size=CONFIG['batch_size'],
        class_mode='categorical',
        classes=CONFIG['class_names'],
        shuffle=False
    )

    test_generator = val_datagen.flow_from_directory(
        test_dir,
        target_size=CONFIG['image_size'],
        batch_size=CONFIG['batch_size'],
        class_mode='categorical',
        classes=CONFIG['class_names'],
        shuffle=False
    ) if test_dir.exists() else None

    return train_generator, val_generator, test_generator


def compute_class_weights(train_generator):
    """Compute class weights to handle imbalanced data."""
    from collections import Counter
    import numpy as np

    class_counts = Counter(train_generator.classes)
    total = sum(class_counts.values())
    num_classes = len(class_counts)

    class_weights = {}
    for class_idx, count in class_counts.items():
        class_weights[class_idx] = total / (num_classes * count)

    print("Class weights:", class_weights)
    return class_weights


def train():
    """Main training function."""
    print("=" * 60)
    print("QUALITY GRADING MODEL TRAINING")
    print("=" * 60)

    # Create model directory
    model_dir = Path(CONFIG['model_dir'])
    model_dir.mkdir(parents=True, exist_ok=True)

    print("\n1. Creating model...")
    model = create_model(CONFIG['num_classes'])
    model.summary()

    model.compile(
        optimizer=Adam(learning_rate=CONFIG['learning_rate']),
        loss='categorical_crossentropy',
        metrics=[
            'accuracy',
            tf.keras.metrics.Precision(name='precision'),
            tf.keras.metrics.Recall(name='recall')
        ]
    )

    print("\n2. Loading data...")
    train_gen, val_gen, test_gen = create_data_generators()

    print(f"   Training samples: {train_gen.samples}")
    print(f"   Validation samples: {val_gen.samples}")
    if test_gen:
        print(f"   Test samples: {test_gen.samples}")

    # Compute class weights for imbalanced data
    class_weights = compute_class_weights(train_gen)

    # Callbacks
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    log_dir = Path(__file__).parent / 'logs' / timestamp
    log_dir.mkdir(parents=True, exist_ok=True)

    callbacks = [
        EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True,
            verbose=1
        ),
        ModelCheckpoint(
            str(model_dir / f'best_model_{timestamp}.h5'),
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-6,
            verbose=1
        ),
        TensorBoard(log_dir=str(log_dir))
    ]

    print("\n3. Phase 1: Training classification head...")
    history = model.fit(
        train_gen,
        epochs=CONFIG['epochs'],
        validation_data=val_gen,
        callbacks=callbacks,
        class_weight=class_weights
    )

    # Fine-tuning phase
    print("\n4. Phase 2: Fine-tuning...")
    base_model = model.layers[0]
    base_model.trainable = True

    # Freeze early layers, train last 30 layers
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=Adam(learning_rate=CONFIG['fine_tune_lr']),
        loss='categorical_crossentropy',
        metrics=[
            'accuracy',
            tf.keras.metrics.Precision(name='precision'),
            tf.keras.metrics.Recall(name='recall')
        ]
    )

    fine_tune_callbacks = [
        EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True,
            verbose=1
        ),
        ModelCheckpoint(
            str(model_dir / f'finetuned_model_{timestamp}.h5'),
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,
            min_lr=1e-7,
            verbose=1
        ),
    ]

    history_fine = model.fit(
        train_gen,
        epochs=CONFIG['fine_tune_epochs'],
        validation_data=val_gen,
        callbacks=fine_tune_callbacks,
        class_weight=class_weights
    )

    # Evaluate on test set
    if test_gen:
        print("\n5. Evaluating on test set...")
        results = model.evaluate(test_gen)
        print(f"   Test Loss: {results[0]:.4f}")
        print(f"   Test Accuracy: {results[1]:.4f}")
        print(f"   Test Precision: {results[2]:.4f}")
        print(f"   Test Recall: {results[3]:.4f}")

    # Save final model
    final_model_path = model_dir / f'final_model_{timestamp}.h5'
    model.save(str(final_model_path))
    print(f"\n6. Model saved to {final_model_path}")

    # Save training config and class names
    config_path = model_dir / f'config_{timestamp}.json'
    with open(config_path, 'w') as f:
        json.dump({
            'class_names': CONFIG['class_names'],
            'image_size': CONFIG['image_size'],
            'timestamp': timestamp,
            'training_samples': train_gen.samples,
            'validation_samples': val_gen.samples,
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
        str(model_dir / f'final_model_{timestamp}.h5'),
        str(model_dir / f'quality_grading_{timestamp}.tflite')
    )

    # Also save as 'latest' for easy access
    convert_to_tflite(
        str(model_dir / f'final_model_{timestamp}.h5'),
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
