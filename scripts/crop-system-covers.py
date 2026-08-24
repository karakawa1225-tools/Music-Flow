from pathlib import Path
from PIL import Image

src = Path(
    r'C:\Users\Karak\.cursor\projects\e-arakawa-factory-app-apps-Hobbies-MUSIC-FLOW\assets'
    r'\c__Users_Karak_AppData_Roaming_Cursor_User_workspaceStorage_7048659f2a50dedb515ff2860367ed23'
    r'_images_ChatGPT_Image_2026_8_21__20_34_14-66a99140-e2aa-4fb3-be37-336ed57d9d9c.png'
)
img = Image.open(src).convert('RGB')
print('size', img.size)

# Photo regions only (exclude dark footer with title / icons)
left = img.crop((48, 42, 488, 470))
right = img.crop((536, 42, 976, 470))

out_web = Path(__file__).resolve().parents[1] / 'src' / 'web' / 'public' / 'system-covers'
out_res = Path(__file__).resolve().parents[1] / 'resources' / 'system-covers'
out_web.mkdir(parents=True, exist_ok=True)
out_res.mkdir(parents=True, exist_ok=True)

for name, crop in [('favorites', left), ('recent', right)]:
    target_w = 640
    target_h = int(target_w * crop.height / crop.width)
    resized = crop.resize((target_w, target_h), Image.Resampling.LANCZOS)
    for dest in (out_web / f'{name}.png', out_res / f'{name}.png'):
        resized.save(dest, optimize=True)
        print('wrote', dest, resized.size)
