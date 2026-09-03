import pandas as pd
import warnings
warnings.filterwarnings('ignore')

file_path = '/Users/saadmatar/Downloads/AnaHon_Document_Vault/TRF-2025-IMS/Budget/Budget_IMS Grantee_Anahon2.xlsx'
try:
    df = pd.read_excel(file_path, sheet_name=None)
    for name, data in df.items():
        print(f"--- Sheet: {name} ---")
        # Find rows containing "total" or "amount" or "deposit" or "tranche"
        for idx, row in data.iterrows():
            row_str = str(row.values).lower()
            if 'total' in row_str or 'amount' in row_str or 'budget' in row_str or 'grant' in row_str or 'tranche' in row_str or 'payment' in row_str:
                print(row.values)
except Exception as e:
    print(e)
