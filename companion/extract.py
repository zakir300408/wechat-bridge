"""Read only approved attachment paths supplied by the local MCP boundary."""
import sys,json
from pathlib import Path
p=Path(sys.argv[1])
if p.suffix.lower()=='.pdf':
 from pypdf import PdfReader
 for i,page in enumerate(PdfReader(p).pages): print(f'\n[Page {i+1}]\n'+(page.extract_text() or '[No extractable text; OCR not performed]'))
elif p.suffix.lower()=='.docx':
 from docx import Document
 d=Document(p)
 for i,paragraph in enumerate(d.paragraphs): print(f'[Paragraph {i+1}] {paragraph.text}')
 for t in d.tables:
  for row in t.rows: print(' | '.join(c.text for c in row.cells))
elif p.suffix.lower()=='.xlsx':
 from openpyxl import load_workbook
 w=load_workbook(p,read_only=True,data_only=True)
 for s in w:
  print(f'\n[Sheet {s.title}]')
  for row in s.iter_rows():
   vals=[f'{c.coordinate}={c.value}' for c in row if c.value is not None]
   if vals: print(' | '.join(vals))
 w.close()
else: raise ValueError('Unsupported format')
