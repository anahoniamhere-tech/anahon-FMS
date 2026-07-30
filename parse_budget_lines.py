import pandas as pd
import warnings
warnings.filterwarnings('ignore')

file_path = '/Users/saadmatar/Downloads/AnaHon_Document_Vault/TRF-2025-IMS/Budget/Budget_IMS Grantee_Anahon2.xlsx'
try:
    df = pd.read_excel(file_path, sheet_name='Budget')
    for idx, row in df.iterrows():
        # if column 0 contains something like A.1.1 or similar, or just print everything
        print(row.values[:10])
except Exception as e:
    print(e)
