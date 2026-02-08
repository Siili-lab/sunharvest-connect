"""
Data Preparation Script for Quality Grading Model

Combines multiple datasets into a unified training format:
- VegNet (Unripe, Ripe, Old, Dried, Damaged) -> 4 grades
- Visual Dataset (Fresh, Rotten) -> 2 grades mapped to Premium/Reject
- Vegetable Images -> Crop identification (separate task)
- Spinach Dataset (Fresh, Non-fresh) -> 2 grades mapped to Premium/Grade B
"""

import os
import shutil
import zipfile
import random
from pathlib import Path
from collections import defaultdict

# Base paths
ML_DATA_DIR = Path(__file__).parent.parent.parent / "data"
OUTPUT_DIR = ML_DATA_DIR / "unified_quality"

# Grade mapping: all source labels -> 4 target grades
# Premium (best), Grade A (good), Grade B (acceptable), Reject (unusable)
GRADE_MAPPING = {
    # VegNet quality levels
    "Ripe": "premium",
    "Unripe": "grade_a",      # Still sellable, just not peak
    "Old": "grade_b",          # Degrading but usable
    "Dried": "reject",
    "Damaged": "reject",

    # Fresh/Rotten datasets
    "Fresh": "premium",
    "fresh": "premium",
    "FreshApple": "premium",
    "FreshBanana": "premium",
    "FreshMango": "premium",
    "FreshOrange": "premium",
    "FreshPotato": "premium",
    "FreshTomato": "premium",

    "Rotten": "reject",
    "rotten": "reject",
    "RottenApple": "reject",
    "RottenBanana": "reject",
    "RottenMango": "reject",
    "RottenOrange": "reject",
    "RottenPotato": "reject",
    "RottenTomato": "reject",

    # Spinach dataset
    "Malabar Spinach Fresh": "premium",
    "Red Spinach Fresh": "premium",
    "Water Spinach Fresh": "premium",
    "Malabar Spinach Non fresh": "grade_b",
    "Red Spinach Non Fresh": "grade_b",
    "Water Spinach Non fresh": "grade_b",
}

# Crop name normalization
CROP_MAPPING = {
    # VegNet
    "1. Bell Pepper": "pepper",
    "2. Chile Pepper": "pepper",
    "3. New Mexico Green Chile": "pepper",
    "4. Tomato": "tomato",

    # Visual Dataset
    "Apple": "apple",
    "Banana": "banana",
    "Mango": "mango",
    "Orange": "orange",
    "Potato": "potato",
    "Tomato": "tomato",

    # Vegetable Images
    "Cabbage": "cabbage",
    "Carrot": "carrot",
    "Capsicum": "pepper",
    "Brinjal": "brinjal",
    "Cauliflower": "cauliflower",
    "Cucumber": "cucumber",
    "Radish": "radish",
    "Pumpkin": "pumpkin",
    "Papaya": "papaya",
    "Bean": "bean",
    "Bitter_Gourd": "bitter_gourd",
    "Bottle_Gourd": "bottle_gourd",
    "Broccoli": "broccoli",

    # Spinach
    "Malabar Spinach": "spinach",
    "Red Spinach": "spinach",
    "Water Spinach": "spinach",
}


def extract_vegnet():
    """Extract VegNet zip if not already extracted."""
    vegnet_dir = ML_DATA_DIR / "VegNet Vegetable Dataset with quality (Unripe, Ripe, Old, Dried and Damaged)"
    zip_path = vegnet_dir / "VegNet (Unripe, Ripe, Old, Dried and Damaged).zip"
    extract_dir = vegnet_dir / "extracted"

    if not extract_dir.exists() and zip_path.exists():
        print("Extracting VegNet dataset...")
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(extract_dir)
        print("VegNet extracted.")

    return extract_dir / "New VegNet"


def prepare_output_dirs():
    """Create output directory structure."""
    for grade in ["premium", "grade_a", "grade_b", "reject"]:
        (OUTPUT_DIR / "train" / grade).mkdir(parents=True, exist_ok=True)
        (OUTPUT_DIR / "val" / grade).mkdir(parents=True, exist_ok=True)
        (OUTPUT_DIR / "test" / grade).mkdir(parents=True, exist_ok=True)
    print(f"Output directories created at {OUTPUT_DIR}")


def copy_images_with_split(src_files: list, grade: str, crop: str, train_ratio=0.7, val_ratio=0.15):
    """Copy images to train/val/test splits."""
    random.shuffle(src_files)
    n = len(src_files)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    splits = {
        "train": src_files[:train_end],
        "val": src_files[train_end:val_end],
        "test": src_files[val_end:]
    }

    count = 0
    for split_name, files in splits.items():
        dest_dir = OUTPUT_DIR / split_name / grade
        for i, src_path in enumerate(files):
            ext = src_path.suffix.lower()
            if ext not in ['.jpg', '.jpeg', '.png', '.bmp']:
                continue
            dest_name = f"{crop}_{grade}_{split_name}_{i:05d}{ext}"
            dest_path = dest_dir / dest_name
            try:
                shutil.copy2(src_path, dest_path)
                count += 1
            except Exception as e:
                print(f"  Error copying {src_path}: {e}")

    return count


def process_vegnet():
    """Process VegNet dataset (quality-graded peppers and tomatoes)."""
    print("\n=== Processing VegNet Dataset ===")
    vegnet_dir = extract_vegnet()

    if not vegnet_dir or not vegnet_dir.exists():
        print("VegNet not found, skipping...")
        return 0

    total = 0
    for crop_dir in vegnet_dir.iterdir():
        if not crop_dir.is_dir():
            continue

        crop_name = crop_dir.name
        crop_normalized = CROP_MAPPING.get(crop_name, crop_name.lower().replace(" ", "_"))

        for quality_dir in crop_dir.iterdir():
            if not quality_dir.is_dir():
                continue

            quality = quality_dir.name
            grade = GRADE_MAPPING.get(quality)

            if not grade:
                print(f"  Unknown quality '{quality}', skipping...")
                continue

            images = list(quality_dir.glob("*"))
            images = [f for f in images if f.suffix.lower() in ['.jpg', '.jpeg', '.png']]

            if images:
                copied = copy_images_with_split(images, grade, crop_normalized)
                print(f"  {crop_name}/{quality} -> {grade}: {copied} images")
                total += copied

    return total


def process_visual_dataset():
    """Process Visual Dataset (Fresh/Rotten fruits)."""
    print("\n=== Processing Visual Dataset ===")
    visual_dir = ML_DATA_DIR / "Dataset" / "Visual_Dataset"

    if not visual_dir.exists():
        print("Visual Dataset not found, skipping...")
        return 0

    total = 0
    for split in ["Train", "Test"]:
        split_dir = visual_dir / split
        if not split_dir.exists():
            continue

        for class_dir in split_dir.iterdir():
            if not class_dir.is_dir():
                continue

            class_name = class_dir.name
            grade = GRADE_MAPPING.get(class_name)

            if not grade:
                # Try to extract crop and freshness
                if class_name.startswith("Fresh"):
                    grade = "premium"
                    crop = class_name.replace("Fresh", "").lower()
                elif class_name.startswith("Rotten"):
                    grade = "reject"
                    crop = class_name.replace("Rotten", "").lower()
                else:
                    print(f"  Unknown class '{class_name}', skipping...")
                    continue
            else:
                crop = class_name.lower()

            images = list(class_dir.glob("*"))
            images = [f for f in images if f.suffix.lower() in ['.jpg', '.jpeg', '.png']]

            if images:
                copied = copy_images_with_split(images, grade, crop)
                print(f"  {class_name} -> {grade}: {copied} images")
                total += copied

    return total


def process_spinach_dataset():
    """Process Spinach Dataset (Fresh/Non-fresh)."""
    print("\n=== Processing Spinach Dataset ===")
    spinach_dir = ML_DATA_DIR / "Local Spanish Leaf Disease Dataset"

    if not spinach_dir.exists():
        print("Spinach Dataset not found, skipping...")
        return 0

    total = 0
    for class_dir in spinach_dir.iterdir():
        if not class_dir.is_dir():
            continue

        class_name = class_dir.name
        grade = GRADE_MAPPING.get(class_name)

        if not grade:
            # Infer from name
            if "Fresh" in class_name and "Non" not in class_name:
                grade = "premium"
            elif "Non fresh" in class_name or "Non Fresh" in class_name:
                grade = "grade_b"
            else:
                print(f"  Unknown class '{class_name}', skipping...")
                continue

        images = list(class_dir.glob("*"))
        images = [f for f in images if f.suffix.lower() in ['.jpg', '.jpeg', '.png']]

        if images:
            copied = copy_images_with_split(images, grade, "spinach")
            print(f"  {class_name} -> {grade}: {copied} images")
            total += copied

    return total


def process_vegetable_images_for_augmentation():
    """
    Process Vegetable Images dataset.
    Since this has no quality labels, we use it to augment crop diversity.
    All images go to 'grade_a' as assumed good quality store images.
    """
    print("\n=== Processing Vegetable Images (as Grade A) ===")
    veg_dir = ML_DATA_DIR / "Vegetable Images"

    if not veg_dir.exists():
        print("Vegetable Images not found, skipping...")
        return 0

    # Only use crops that match our app's crop list
    target_crops = ["Cabbage", "Carrot", "Potato", "Tomato", "Capsicum"]

    total = 0
    for split in ["train", "test", "validation"]:
        split_dir = veg_dir / split
        if not split_dir.exists():
            continue

        for crop_dir in split_dir.iterdir():
            if not crop_dir.is_dir():
                continue

            crop_name = crop_dir.name
            if crop_name not in target_crops:
                continue

            crop_normalized = CROP_MAPPING.get(crop_name, crop_name.lower())

            images = list(crop_dir.glob("*"))
            images = [f for f in images if f.suffix.lower() in ['.jpg', '.jpeg', '.png']]

            # Limit to avoid imbalance - take only 200 per crop
            if len(images) > 200:
                images = random.sample(images, 200)

            if images:
                copied = copy_images_with_split(images, "grade_a", crop_normalized)
                print(f"  {crop_name} -> grade_a: {copied} images")
                total += copied

    return total


def print_summary():
    """Print dataset summary."""
    print("\n" + "=" * 50)
    print("DATASET SUMMARY")
    print("=" * 50)

    for split in ["train", "val", "test"]:
        print(f"\n{split.upper()}:")
        split_dir = OUTPUT_DIR / split
        if not split_dir.exists():
            continue

        total = 0
        for grade_dir in sorted(split_dir.iterdir()):
            if grade_dir.is_dir():
                count = len(list(grade_dir.glob("*")))
                print(f"  {grade_dir.name}: {count} images")
                total += count
        print(f"  TOTAL: {total}")


def main():
    """Main preparation pipeline."""
    print("=" * 50)
    print("DATA PREPARATION FOR QUALITY GRADING MODEL")
    print("=" * 50)

    # Clean and recreate output directory
    if OUTPUT_DIR.exists():
        print(f"Cleaning existing output directory: {OUTPUT_DIR}")
        shutil.rmtree(OUTPUT_DIR)

    prepare_output_dirs()

    # Process each dataset
    total = 0
    total += process_vegnet()
    total += process_visual_dataset()
    total += process_spinach_dataset()
    total += process_vegetable_images_for_augmentation()

    print(f"\n\nTotal images processed: {total}")

    print_summary()

    print("\n" + "=" * 50)
    print("Data preparation complete!")
    print(f"Output directory: {OUTPUT_DIR}")
    print("=" * 50)


if __name__ == "__main__":
    random.seed(42)  # For reproducibility
    main()
