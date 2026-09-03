import pandas as pd
import re
import warnings
warnings.filterwarnings('ignore')

try:
    df = pd.read_excel('/Users/saadmatar/Downloads/TRF-2025-IMS_Reconciliation_2026-05.xlsx', sheet_name=None)
    for sheet_name, data in df.items():
        text = data.to_string().lower()
        if 'chatgpt' in text or 'midjourney' in text or 'claude' in text or 'ai' in text:
            print(f"Found in sheet {sheet_name}:")
            # Print rows that contain 'ai ' or 'chatgpt' or 'midjourney'
            for idx, row in data.iterrows():
                row_str = str(row.values).lower()
                if 'chatgpt' in row_str or 'midjourney' in row_str or 'claude' in row_str or 'ai ' in row_str or 'ai,' in row_str:
                    print(row.values)
except Exception as e:
    print("Error reading excel:", e)
