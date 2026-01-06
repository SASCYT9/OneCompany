from PIL import Image
import sys
import os

def make_white(input_path, output_path):
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        
        datas = img.getdata()
        
        newData = []
        for item in datas:
            # item is (R, G, B, A)
            # Change all non-transparent pixels to white (255, 255, 255)
            # Preserve the Alpha channel
            if item[3] > 0:
                newData.append((255, 255, 255, item[3]))
            else:
                newData.append(item)
        
        img.putdata(newData)
        img.save(output_path, "PNG")
        print(f"Successfully created white logo at {output_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python make_white.py <input_path> <output_path>")
    else:
        make_white(sys.argv[1], sys.argv[2])
