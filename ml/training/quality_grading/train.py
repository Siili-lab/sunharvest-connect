"""
Quality Grading Model Training Pipeline

Trains a MobileNetV2-based classifier for produce quality grading.
Optimized for mobile deployment with TensorFlow Lite.
"""

import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, TensorBoard
import os
from datetime import datetime

# Configuration
CONFIG = {
    'image_size': (224, 224),
    'batch_size': 32,
    'epochs': 50,
    'learning_rate': 0.001,
    'num_classes': 4,  # Premium, Grade A, Grade B, Reject
    'class_names': ['premium', 'grade_a', 'grade_b', 'reject'],
    'data_dir': '../data/quality_grading',
    'model_dir': '../models/quality_grading',
}


def create_model(num_classes: int) -> Model:
    """
    Create MobileNetV2 model with custom classification head.

    Uses transfer learning from ImageNet weights.
    """
    # Load pre-trained MobileNetV2 (excluding top layers)
    base_model = MobileNetV2(
        weights='imagenet',
        include_top=False,
        input_shape=(*CONFIG['image_size'], 3)
    )

    # Freeze base model layers
    base_model.trainable = False

    # Add custom classification head
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(256, activation='relu')(x)
    x = Dropout(0.5)(x)
    x = Dense(128, activation='relu')(x)
    x = Dropout(0.3)(x)
    outputs = Dense(num_classes, activation='softmax')(x)

    model = Model(inputs=base_model.input, outputs=outputs)

    return model


def create_data_generators():
    """
    Create training and validation data generators with augmentation.
    """
    train_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
        rescale=1./255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        horizontal_flip=True,
        vertical_flip=True,
        brightness_range=[0.8, 1.2],
        zoom_range=0.2,
        validation_split=0.2
    )

    train_generator = train_datagen.flow_from_directory(
        CONFIG['data_dir'],
        target_size=CONFIG['image_size'],
        batch_size=CONFIG['batch_size'],
        class_mode='categorical',
        subset='training',
        shuffle=True
    )

    val_generator = train_datagen.flow_from_directory(
        CONFIG['data_dir'],
        target_size=CONFIG['image_size'],
        batch_size=CONFIG['batch_size'],
        class_mode='categorical',
        subset='validation',
        shuffle=False
    )

    return train_generator, val_generator


def train():
    """
    Main training function.
    """
    print("Creating model...")
    model = create_model(CONFIG['num_classes'])

    model.compile(
        optimizer=Adam(learning_rate=CONFIG['learning_rate']),
        loss='categorical_crossentropy',
        metrics=['accuracy', tf.keras.metrics.Precision(), tf.keras.metrics.Recall()]
    )

    print("Loading data...")
    train_gen, val_gen = create_data_generators()

    # Callbacks
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    callbacks = [
        EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True
        ),
        ModelCheckpoint(
            f"{CONFIG['model_dir']}/best_model_{timestamp}.h5",
            monitor='val_accuracy',
            save_best_only=True
        ),
        TensorBoard(
            log_dir=f"./logs/{timestamp}"
        )
    ]

    print("Starting training...")
    history = model.fit(
        train_gen,
        epochs=CONFIG['epochs'],
        validation_data=val_gen,
        callbacks=callbacks
    )

    # Fine-tune: unfreeze some base layers
    print("Fine-tuning...")
    model.layers[0].trainable = True
    for layer in model.layers[0].layers[:-20]:
        layer.trainable = False

    model.compile(
        optimizer=Adam(learning_rate=CONFIG['learning_rate'] / 10),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    model.fit(
        train_gen,
        epochs=20,
        validation_data=val_gen,
        callbacks=callbacks
    )

    # Save final model
    model.save(f"{CONFIG['model_dir']}/final_model_{timestamp}.h5")
    print(f"Model saved to {CONFIG['model_dir']}")

    return model


def convert_to_tflite(model_path: str, output_path: str):
    """
    Convert Keras model to TensorFlow Lite for mobile deployment.
    """
    model = tf.keras.models.load_model(model_path)

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]

    tflite_model = converter.convert()

    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    print(f"TFLite model saved to {output_path}")
    print(f"Model size: {os.path.getsize(output_path) / 1024 / 1024:.2f} MB")


if __name__ == '__main__':
    model = train()
    convert_to_tflite(
        f"{CONFIG['model_dir']}/final_model.h5",
        f"{CONFIG['model_dir']}/quality_grading.tflite"
    )
