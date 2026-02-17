
Add-Type -AssemblyName System.Drawing

function Create-GradientImage {
    param (
        [int]$width,
        [int]$height,
        [string]$startColorHex,
        [string]$endColorHex,
        [bool]$isVertical,
        [string]$outputPath
    )

    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    $startColor = [System.Drawing.ColorTranslator]::FromHtml($startColorHex)
    $endColor = [System.Drawing.ColorTranslator]::FromHtml($endColorHex)
    
    $rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $mode = if ($isVertical) { [System.Drawing.Drawing2D.LinearGradientMode]::Vertical } else { [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal }
    
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $startColor, $endColor, $mode)
    $graphics.FillRectangle($brush, $rect)
    
    # Add a simple 'wallet' icon placeholder (rectangle with rounded corners look)
    # Just a subtle shape to make it look designed
    if ($isVertical) {
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(50, 255, 255, 255), 2)
        $graphics.DrawRectangle($pen, 40, 40, 84, 60)
        $graphics.DrawLine($pen, 40, 55, 124, 55)
    }

    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    $graphics.Dispose()
    $bitmap.Dispose()
    
    Write-Host "Created $outputPath"
}

# Ensure build directory exists
if (-not (Test-Path "build")) {
    New-Item -ItemType Directory -Path "build"
}

# Sidebar: 164x314, Navy to Purple Vertical
Create-GradientImage -width 164 -height 314 -startColorHex "#0f172a" -endColorHex "#312e81" -isVertical $true -outputPath "build\installer_sidebar.bmp"

# Header: 150x57, Navy to Purple Horizontal
Create-GradientImage -width 150 -height 57 -startColorHex "#0f172a" -endColorHex "#312e81" -isVertical $false -outputPath "build\installer_header.bmp"
