import gzip
import brotli
import json

if __name__ == "__main__":
    with open('questions.json', 'r') as f:
        data = json.load(f)

    with gzip.open('questions.json.gz', 'wt') as f:
        json.dump(data, f)

    with open('questions.json', 'rb') as f:
        data = f.read()
    compressed = brotli.compress(data)
    with open('questions.json.br', 'wb') as f:
        f.write(compressed)
