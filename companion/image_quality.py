"""Choose genuine local pixels; never invent detail or upscale thumbnails."""
import io
import warnings
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 25_000_000


def dimensions(data):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                size = image.size
                image.verify()
                return size
    except Exception:
        return (0, 0)


def best_asset(assets):
    valid = []
    for asset in assets:
        width, height = dimensions(asset['data'])
        if width and height:
            valid.append(dict(asset, width=width, height=height))
    return max(valid, key=lambda item: (item['width'] * item['height'], bool(item.get('original')), len(item['data']))) if valid else None


def preview(data, limit=1_000_000):
    with warnings.catch_warnings():
        warnings.simplefilter('error', Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(data)) as source:
            image = ImageOps.exif_transpose(source)
            for side in (2048, 1600, 1280, 960, 720):
                image.thumbnail((side, side), Image.Resampling.LANCZOS)
                if image.mode not in ('RGB', 'RGBA'):
                    image = image.convert('RGBA' if 'transparency' in image.info else 'RGB')
                output = io.BytesIO()
                if image.mode == 'RGBA':
                    image.save(output, 'WEBP', quality=90, method=3)
                    mime = 'image/webp'
                else:
                    image.save(output, 'JPEG', quality=92, optimize=True)
                    mime = 'image/jpeg'
                if output.tell() <= limit:
                    return output.getvalue(), mime, image.size
    raise ValueError('Preview cannot fit transport limits')
