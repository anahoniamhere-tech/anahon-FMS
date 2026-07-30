import os
import re
try:
    import PyPDF2
except ImportError:
    os.system('pip install PyPDF2 > /dev/null 2>&1')
    import PyPDF2

folder = '/Users/saadmatar/Desktop/Invoices_TRF'
tools = set()

for file in os.listdir(folder):
    if file.endswith('.pdf'):
        try:
            with open(os.path.join(folder, file), 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages:
                    text += page.extract_text()
                
                # Look for common AI tools or keywords
                if re.search(r'openai|chatgpt', text, re.I): tools.add("OpenAI / ChatGPT")
                if re.search(r'midjourney', text, re.I): tools.add("Midjourney")
                if re.search(r'anthropic|claude', text, re.I): tools.add("Anthropic / Claude")
                if re.search(r'elevenlabs', text, re.I): tools.add("ElevenLabs")
                if re.search(r'runway', text, re.I): tools.add("RunwayML")
                if re.search(r'canva', text, re.I): tools.add("Canva")
                if re.search(r'adobe', text, re.I): tools.add("Adobe")
                if re.search(r'perplexity', text, re.I): tools.add("Perplexity")
                if re.search(r'github copilot', text, re.I): tools.add("GitHub Copilot")
        except Exception as e:
            pass

print("Found AI Tools:", list(tools))
