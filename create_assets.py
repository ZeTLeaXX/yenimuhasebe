
from PIL import Image, ImageDraw

def create_gradient(width, height, start_color, end_color, is_vertical=True):
    image = Image.new("RGB", (width, height), start_color)
    draw = ImageDraw.Draw(image)

    for i in range(width if not is_vertical else height):
        ratio = i / (width if not is_vertical else height)
        r = int(start_color[0] * (1 - ratio) + end_color[0] * ratio)
        g = int(start_color[1] * (1 - ratio) + end_color[1] * ratio)
        b = int(start_color[2] * (1 - ratio) + end_color[2] * ratio)
        color = (r, g, b)
        
        if is_vertical:
            draw.line([(0, i), (width, i)], fill=color)
        else:
            draw.line([(i, 0), (i, height)], fill=color)
            
    return image

# Navy (#0f172a) to Purple (#312e81)
start_color = (15, 23, 42)
end_color = (49, 46, 129)

# Sidebar: 164x314
sidebar = create_gradient(164, 314, start_color, end_color, is_vertical=True)
# Add a simple 'wallet' like shape or just keep it minimal clean gradient
# Let's add a subtle highlight line
draw_sidebar = ImageDraw.Draw(sidebar)
draw_sidebar.line([(20, 50), (144, 50)], fill=(255, 255, 255, 30), width=1)
sidebar.save("build/installer_sidebar.bmp")

# Header: 150x57
header = create_gradient(150, 57, start_color, end_color, is_vertical=False)
header.save("build/installer_header.bmp")

print("Installer assets created in build/")
