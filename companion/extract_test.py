"""Exercise the PDF reader with a synthetic text document, without account data."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject


class PdfExtractionTest(unittest.TestCase):
    def test_pdf_text_reaches_attachment_output(self):
        with tempfile.TemporaryDirectory() as folder:
            document = Path(folder) / "fixture.pdf"
            writer = PdfWriter()
            page = writer.add_blank_page(width=612, height=792)
            font = DictionaryObject({
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            })
            page[NameObject("/Resources")] = DictionaryObject({
                NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})
            })
            text = DecodedStreamObject()
            text.set_data(b"BT /F1 12 Tf 72 720 Td (WeChat Bridge test document) Tj ET")
            page[NameObject("/Contents")] = text
            writer.write(document)
            writer.close()
            result = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("extract.py")), str(document)],
                capture_output=True, text=True, timeout=15, check=True,
            )
            self.assertIn("[Page 1]", result.stdout)
            self.assertIn("WeChat Bridge test document", result.stdout)


if __name__ == "__main__":
    unittest.main()
