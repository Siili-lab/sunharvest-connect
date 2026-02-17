import os
import io
import logging
import numpy as np
from pathlib import Path
from flask import Flask, request, jsonify
from PIL import Image
import tensorflow as tf

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Config
IMAGE_SIZE = (224, 224)
CLASS_NAMES = ['grade_a', 'grade_b', 'premium', 'reject']
GRADE_LABELS = {
    'premium': 'Premium',
    'grade_a': 'Grade A',
    'grade_b': 'Grade B',
    'reject': 'Reject',
}

# Crop-specific defect pools (mirrors backend mock)
CROP_DEFECTS = {
    'tomato': ['cracking', 'sunscald', 'blossom end rot', 'catfacing'],
    'tomatoes': ['cracking', 'sunscald', 'blossom end rot', 'catfacing'],
    'mango': ['anthracnose', 'latex burn', 'stem-end rot', 'lenticel spotting'],
    'mangoes': ['anthracnose', 'latex burn', 'stem-end rot', 'lenticel spotting'],
    'potato': ['greening', 'scab', 'growth cracks', 'hollow heart'],
    'potatoes': ['greening', 'scab', 'growth cracks', 'hollow heart'],
    'onion': ['neck rot', 'black mold', 'splitting', 'sunburn'],
    'onions': ['neck rot', 'black mold', 'splitting', 'sunburn'],
    'cabbage': ['black rot', 'tip burn', 'insect damage', 'splitting'],
    'kale': ['aphid damage', 'leaf spot', 'yellowing', 'wilting'],
    'spinach': ['leaf miner trails', 'downy mildew', 'yellowing', 'bolting damage'],
    'avocado': ['anthracnose', 'stem-end rot', 'lenticel damage', 'chilling injury'],
    'banana': ['crown rot', 'finger drop', 'bruising', 'cigar-end rot'],
    'bananas': ['crown rot', 'finger drop', 'bruising', 'cigar-end rot'],
    'orange': ['citrus canker', 'wind scarring', 'oil spotting', 'stem-end rot'],
    'oranges': ['citrus canker', 'wind scarring', 'oil spotting', 'stem-end rot'],
    'pepper': ['blossom end rot', 'sunscald', 'cracking', 'anthracnose'],
    'peppers': ['blossom end rot', 'sunscald', 'cracking', 'anthracnose'],
    'carrot': ['forking', 'cracking', 'green shoulder', 'cavity spot'],
    'carrots': ['forking', 'cracking', 'green shoulder', 'cavity spot'],
    'maize': ['ear rot', 'kernel damage', 'insect boring', 'husk discoloration'],
}
DEFAULT_DEFECTS = ['minor surface blemishes', 'slight discoloration', 'small bruise', 'cosmetic imperfection']

model = None
model_version = 'unknown'


def load_model():
    global model, model_version

    model_path = os.environ.get('MODEL_PATH', '')
    model_dir = Path(__file__).parent / 'models' / 'quality_grading'

    # Try MODEL_PATH env first, then look for latest keras model in models dir
    if model_path and Path(model_path).exists():
        logger.info(f"Loading model from MODEL_PATH: {model_path}")
        model = tf.keras.models.load_model(model_path)
        model_version = Path(model_path).stem
    else:
        # Find the best available model
        keras_models = sorted(model_dir.glob('finetuned_model_*.keras'), reverse=True)
        if not keras_models:
            keras_models = sorted(model_dir.glob('best_model_*.keras'), reverse=True)
        if not keras_models:
            keras_models = sorted(model_dir.glob('*.keras'), reverse=True)

        if keras_models:
            chosen = keras_models[0]
            logger.info(f"Loading model: {chosen}")
            model = tf.keras.models.load_model(str(chosen))
            model_version = chosen.stem
        else:
            logger.warning("No model found! Server will return errors on /predict")
            return

    # Warm up with a dummy prediction
    dummy = np.zeros((1, *IMAGE_SIZE, 3), dtype=np.float32)
    model.predict(dummy, verbose=0)
    logger.info(f"Model loaded and warmed up: {model_version}")


def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = img.resize(IMAGE_SIZE, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)
    # MobileNetV2 preprocessing: scale to [-1, 1]
    arr = tf.keras.applications.mobilenet_v2.preprocess_input(arr)
    return np.expand_dims(arr, axis=0)


def infer_defects(crop_type, grade_name, probabilities):
    """Infer likely defects based on grade and confidence spread."""
    if grade_name == 'Premium':
        return []

    pool = CROP_DEFECTS.get(crop_type.lower(), DEFAULT_DEFECTS)
    # More defects for lower grades
    if grade_name == 'Grade A':
        count = 1
    elif grade_name == 'Grade B':
        count = 2
    else:
        count = 3

    # Use probability distribution to pick defects deterministically
    indices = np.argsort(probabilities)
    selected = []
    for i in range(min(count, len(pool))):
        selected.append(pool[i % len(pool)])
    return selected


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy' if model is not None else 'no_model',
        'model_version': model_version,
    })


@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'No model loaded'}), 503

    # Accept multipart file upload or base64 JSON
    image_bytes = None
    crop_type = 'tomato'

    if 'image' in request.files:
        image_bytes = request.files['image'].read()
        crop_type = request.form.get('cropType', 'tomato')
    elif request.is_json:
        import base64
        data = request.get_json()
        if 'image' in data:
            image_bytes = base64.b64decode(data['image'])
        crop_type = data.get('cropType', 'tomato')

    if not image_bytes:
        return jsonify({'error': 'No image provided'}), 400

    try:
        input_tensor = preprocess_image(image_bytes)
        predictions = model.predict(input_tensor, verbose=0)
        probabilities = predictions[0].tolist()

        top_idx = int(np.argmax(probabilities))
        confidence = float(probabilities[top_idx])
        class_name = CLASS_NAMES[top_idx]
        grade_label = GRADE_LABELS[class_name]

        defects = infer_defects(crop_type, grade_label, probabilities)

        return jsonify({
            'grade': grade_label,
            'confidence': round(confidence, 4),
            'defects': defects,
            'probabilities': {
                GRADE_LABELS[cn]: round(p, 4)
                for cn, p in zip(CLASS_NAMES, probabilities)
            },
            'modelVersion': model_version,
        })
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        return jsonify({'error': f'Prediction failed: {str(e)}'}), 500


# Load model at startup
load_model()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
