# example.py
import ddddocr
import sys
if len(sys.argv) != 2:
    print("Usage: python3 ca.py <imagePath>")
    sys.exit(1)

image_path = sys.argv[1]
ocr = ddddocr.DdddOcr(show_ad=0)

image = open(image_path, "rb").read()
result = ocr.classification(image)
print(result.upper())