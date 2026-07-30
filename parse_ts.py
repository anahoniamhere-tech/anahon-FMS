import pandas as pd
try:
    df = pd.read_excel('/Users/saadmatar/Downloads/Timesheet_Saad_TRF_Feb_Mar_2026_adjusted.xlsx', sheet_name=None)
    for name, data in df.items():
        print(f"--- Saad Sheet: {name} ---")
        print(data.head())
except Exception as e:
    print(e)
