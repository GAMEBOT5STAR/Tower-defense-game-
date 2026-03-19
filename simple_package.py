#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import shutil
import datetime

def package_game():
    """简单打包游戏文件"""
    
    # 当前目录
    source_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 目标目录（桌面）
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    package_name = f"攻打台娃塔防游戏_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
    target_dir = os.path.join(desktop, package_name)
    
    # 创建目标目录
    os.makedirs(target_dir, exist_ok=True)
    
    # 复制文件
    files = ["index.html", "game.js", "styles.css", "levels.json", 
             "README.md", "extract_pdf.py", "pdf_content.txt"]
    
    for file in files:
        source = os.path.join(source_dir, file)
        target = os.path.join(target_dir, file)
        if os.path.exists(source):
            shutil.copy2(source, target)
            print(f"复制: {file}")
    
    # 复制assets目录
    assets_source = os.path.join(source_dir, "assets")
    assets_target = os.path.join(target_dir, "assets")
    if os.path.exists(assets_source):
        shutil.copytree(assets_source, assets_target, dirs_exist_ok=True)
        print("复制: assets目录")
    
    # 创建运行说明
    readme = os.path.join(target_dir, "运行说明.txt")
    with open(readme, 'w', encoding='utf-8') as f:
        f.write(f"""攻打台娃塔防游戏

运行方式:
1. 双击 index.html 文件直接在浏览器中打开
2. 或使用本地服务器: python -m http.server 8080

游戏特色:
- 完整实现PDF设计方案
- 5个关卡从高雄到台北
- 三种防御塔和敌人类型
- 现代化HTML5游戏引擎

打包时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
""")
    
    print(f"\n打包完成!")
    print(f"保存位置: {target_dir}")
    return target_dir

if __name__ == "__main__":
    package_game()