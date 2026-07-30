import pandas as pd

file_path = '/Users/saadmatar/Downloads/TRF-2025-IMS_Reconciliation_2026-05.xlsx'
try:
    df = pd.read_excel(file_path, sheet_name=None)
    for name, data in df.items():
        print(f"--- Sheet: {name} ---")
        print(data.head(20).to_string())
except Exception as e:
    print(e)
