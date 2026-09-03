import sys
import fitz  # PyMuPDF

for file in sys.argv[1:]:
    print(f"--- {file} ---")
    try:
        doc = fitz.open(file)
        for page in doc:
            print(page.get_text())
    except Exception as e:
        print(f"Error reading {file}: {e}")
