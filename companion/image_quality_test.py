import io
import unittest
from PIL import Image
from image_quality import best_asset, preview


def fixture(size):
    output = io.BytesIO()
    Image.new('RGB', size, '#39837a').save(output, 'PNG')
    return output.getvalue()


class ImageQualityTests(unittest.TestCase):
    def test_original_replaces_a_thumbnail_regardless_of_scan_order(self):
        thumb = {'data': fixture((128, 80)), 'original': False}
        original = {'data': fixture((1600, 1000)), 'original': True}
        for candidates in ([thumb, original], [original, thumb]):
            result = best_asset(candidates)
            self.assertTrue(result['original'])
            self.assertEqual((result['width'], result['height']), (1600, 1000))

    def test_preview_does_not_upscale_missing_detail(self):
        result, mime, size = preview(fixture((143, 204)))
        self.assertEqual(size, (143, 204))
        self.assertLess(len(result), 1_000_000)
        self.assertEqual(mime, 'image/jpeg')

    def test_bad_content_is_not_treated_as_an_image(self):
        self.assertIsNone(best_asset([{'data': b'not an image', 'original': True}]))


if __name__ == '__main__':
    unittest.main()
