"""
Model Evaluation and Bias Testing

Evaluates model performance across different segments
to detect and document potential biases.
"""

import tensorflow as tf
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
import json
from pathlib import Path


class BiasEvaluator:
    """
    Evaluates model for fairness across different segments.
    Required for NIRU AI Hackathon ethical AI compliance.
    """

    def __init__(self, model_path: str, test_data_path: str):
        self.model = tf.keras.models.load_model(model_path)
        self.test_data_path = test_data_path
        self.class_names = ['premium', 'grade_a', 'grade_b', 'reject']
        self.results = {}

    def evaluate_by_region(self, metadata_df: pd.DataFrame):
        """
        Evaluate model performance across different regions.

        Checks if model performs equally well for produce from
        Central, Eastern, Western Kenya.
        """
        regions = metadata_df['region'].unique()
        region_metrics = {}

        for region in regions:
            region_data = metadata_df[metadata_df['region'] == region]
            images = self._load_images(region_data['image_path'].tolist())
            labels = region_data['label'].tolist()

            predictions = self.model.predict(images)
            pred_classes = np.argmax(predictions, axis=1)

            accuracy = np.mean(pred_classes == labels)
            region_metrics[region] = {
                'accuracy': float(accuracy),
                'sample_count': len(labels),
                'report': classification_report(
                    labels, pred_classes,
                    target_names=self.class_names,
                    output_dict=True
                )
            }

        self.results['by_region'] = region_metrics
        return region_metrics

    def evaluate_by_lighting(self, metadata_df: pd.DataFrame):
        """
        Evaluate model performance across lighting conditions.

        Farmers may take photos in various lighting:
        - Direct sunlight
        - Shade
        - Indoor
        """
        lighting_conditions = ['sunlight', 'shade', 'indoor']
        lighting_metrics = {}

        for condition in lighting_conditions:
            condition_data = metadata_df[metadata_df['lighting'] == condition]
            if len(condition_data) == 0:
                continue

            images = self._load_images(condition_data['image_path'].tolist())
            labels = condition_data['label'].tolist()

            predictions = self.model.predict(images)
            pred_classes = np.argmax(predictions, axis=1)

            accuracy = np.mean(pred_classes == labels)
            lighting_metrics[condition] = {
                'accuracy': float(accuracy),
                'sample_count': len(labels)
            }

        self.results['by_lighting'] = lighting_metrics
        return lighting_metrics

    def evaluate_by_camera_quality(self, metadata_df: pd.DataFrame):
        """
        Evaluate model performance across device camera qualities.

        Farmers have different phone models with varying camera quality.
        """
        quality_levels = ['low', 'medium', 'high']
        camera_metrics = {}

        for quality in quality_levels:
            quality_data = metadata_df[metadata_df['camera_quality'] == quality]
            if len(quality_data) == 0:
                continue

            images = self._load_images(quality_data['image_path'].tolist())
            labels = quality_data['label'].tolist()

            predictions = self.model.predict(images)
            pred_classes = np.argmax(predictions, axis=1)

            accuracy = np.mean(pred_classes == labels)
            camera_metrics[quality] = {
                'accuracy': float(accuracy),
                'sample_count': len(labels)
            }

        self.results['by_camera_quality'] = camera_metrics
        return camera_metrics

    def generate_bias_report(self) -> dict:
        """
        Generate comprehensive bias report for documentation.
        """
        report = {
            'model_version': self._get_model_version(),
            'evaluation_date': pd.Timestamp.now().isoformat(),
            'metrics': self.results,
            'bias_flags': self._identify_bias_flags(),
            'mitigation_recommendations': self._get_recommendations()
        }

        return report

    def _identify_bias_flags(self) -> list:
        """
        Identify potential bias issues where accuracy differs >10%
        between segments.
        """
        flags = []

        for category, metrics in self.results.items():
            accuracies = [m['accuracy'] for m in metrics.values() if 'accuracy' in m]
            if len(accuracies) > 1:
                max_diff = max(accuracies) - min(accuracies)
                if max_diff > 0.10:  # 10% threshold
                    flags.append({
                        'category': category,
                        'max_difference': float(max_diff),
                        'severity': 'high' if max_diff > 0.20 else 'medium'
                    })

        return flags

    def _get_recommendations(self) -> list:
        """
        Generate recommendations based on identified biases.
        """
        recommendations = []

        for flag in self._identify_bias_flags():
            if flag['category'] == 'by_region':
                recommendations.append(
                    "Collect more training data from underperforming regions"
                )
            elif flag['category'] == 'by_lighting':
                recommendations.append(
                    "Add more data augmentation for lighting variation"
                )
            elif flag['category'] == 'by_camera_quality':
                recommendations.append(
                    "Include image degradation in training augmentation"
                )

        return recommendations

    def _load_images(self, paths: list) -> np.ndarray:
        """Load and preprocess images."""
        images = []
        for path in paths:
            img = tf.keras.preprocessing.image.load_img(path, target_size=(224, 224))
            img_array = tf.keras.preprocessing.image.img_to_array(img)
            img_array = img_array / 255.0
            images.append(img_array)
        return np.array(images)

    def _get_model_version(self) -> str:
        """Get model version from metadata."""
        return "v1.0.0"


def save_report(report: dict, output_path: str):
    """Save bias report to JSON file."""
    with open(output_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"Bias report saved to {output_path}")


if __name__ == '__main__':
    evaluator = BiasEvaluator(
        model_path='../models/quality_grading/best_model.h5',
        test_data_path='../data/quality_grading/test'
    )

    # Load test metadata
    metadata = pd.read_csv('../data/quality_grading/test_metadata.csv')

    # Run evaluations
    evaluator.evaluate_by_region(metadata)
    evaluator.evaluate_by_lighting(metadata)
    evaluator.evaluate_by_camera_quality(metadata)

    # Generate and save report
    report = evaluator.generate_bias_report()
    save_report(report, '../reports/bias_evaluation.json')
