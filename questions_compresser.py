import gzip
import json

def compress_json():
    with open('questions.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    json_str = json.dumps(data)
    compressed = gzip.compress(json_str.encode('utf-8'))
    
    with open('questions.json.gz', 'wb') as f:
        f.write(compressed)

if __name__ == '__main__':
    compress_json()

