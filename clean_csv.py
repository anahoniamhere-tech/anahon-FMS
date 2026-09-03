import csv
import json
import re
from datetime import datetime

input_file = "/Users/saadmatar/Downloads/ticket_buyers (1).csv"
output_file = "/Users/saadmatar/Downloads/ticket_buyers_cleaned.csv"

def clean_name(name):
    name = name.strip()
    # Title case the name if it's English, leave Arabic as is
    # Python's title() works fine on Arabic (it just leaves it alone)
    return ' '.join(word.capitalize() for word in name.split())

def clean_phone(phone):
    phone = phone.strip()
    # Remove all spaces and dashes
    phone = re.sub(r'[\s\-]', '', phone)
    # If it starts with 00, replace with +
    if phone.startswith('00'):
        phone = '+' + phone[2:]
    return phone

with open(input_file, 'r', encoding='utf-8') as f_in, open(output_file, 'w', encoding='utf-8', newline='') as f_out:
    reader = csv.DictReader(f_in)
    
    # We will remove 'totalPrice' and update 'emailStatus'
    fieldnames = list(reader.fieldnames)
    if 'totalPrice' in fieldnames:
        fieldnames.remove('totalPrice')
    
    writer = csv.DictWriter(f_out, fieldnames=fieldnames)
    writer.writeheader()
    
    for row in reader:
        # Clean createdAt
        try:
            ts_data = json.loads(row['createdAt'])
            seconds = ts_data.get('seconds', 0)
            dt = datetime.fromtimestamp(seconds)
            row['createdAt'] = dt.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            pass # keep as is if it fails
        
        # Clean name
        if row.get('name'):
            row['name'] = clean_name(row['name'])
            
        # Clean phone
        if row.get('phone'):
            row['phone'] = clean_phone(row['phone'])
            
        # Update emailStatus to sent
        if 'emailStatus' in row:
            row['emailStatus'] = 'sent'
            
        # Remove empty totalPrice
        if 'totalPrice' in row:
            del row['totalPrice']
            
        writer.writerow(row)

print(f"Cleaned CSV saved to: {output_file}")
