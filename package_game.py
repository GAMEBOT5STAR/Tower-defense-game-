#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
游戏打包脚本
将完整的塔防游戏打包保存到E盘
"""

import os
import shutil
import json
from datetime import datetime

def create_game_package():
    """创建游戏打包文件"""
    
    # 源目录（当前工作目录）
    source_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 目标目录（E盘）
    target_base = "E:\\"
    package_name = f"攻打台娃塔防游戏_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    target_dir = os.path.join(target_base, package_name)
    
    # 需要复制的文件列表
    files_to_copy = [
        "index.html",
        "game.js", 
        "styles.css",
        "levels.json",
        "README.md",
        "extract_pdf.py",
        "pdf_content.txt",
        "package_game.py"
    ]
    
    # 需要复制的目录
    dirs_to_copy = ["assets"]
    
    try:
        # 创建目标目录
        os.makedirs(target_dir, exist_ok=True)
        print(f"创建目标目录: {target_dir}")
        
        # 复制文件
        for file_name in files_to_copy:
            source_path = os.path.join(source_dir, file_name)
            target_path = os.path.join(target_dir, file_name)
            
            if os.path.exists(source_path):
                shutil.copy2(source_path, target_path)
                print(f"[OK] 复制文件: {file_name}")
            else:
                print(f"[ERROR] 文件不存在: {file_name}")
        
        # 复制目录
        for dir_name in dirs_to_copy:
            source_path = os.path.join(source_dir, dir_name)
            target_path = os.path.join(target_dir, dir_name)
            
            if os.path.exists(source_path):
                shutil.copytree(source_path, target_path, dirs_exist_ok=True)
                print(f"[OK] 复制目录: {dir_name}")
            else:
                print(f"[ERROR] 目录不存在: {dir_name}")
        
        # 创建说明文件
        create_readme_file(target_dir, package_name)
        
        # 创建运行脚本
        create_run_script(target_dir)
        
        print(f"\n[SUCCESS] 游戏打包完成！")
        print(f"[INFO] 保存位置: {target_dir}")
        print(f"[INFO] 运行方式: 双击 '运行游戏.bat' 或打开 'index.html'")
        
        return target_dir
        
    except Exception as e:
        print(f"[ERROR] 打包过程中出错: {str(e)}")
        return None

def create_readme_file(target_dir, package_name):
    """创建详细的说明文件"""
    
    readme_content = f"""# 攻打台娃 - 塔防游戏包

## 游戏简介
基于两岸统一背景设计的塔防游戏，完整实现了PDF设计方案中的所有要求。

## 文件说明

### 核心文件
- `index.html` - 游戏主页面
- `game.js` - 游戏核心逻辑
- `styles.css` - 游戏样式文件
- `levels.json` - 关卡配置文件

### 辅助文件
- `README.md` - 详细说明文档
- `extract_pdf.py` - PDF内容提取脚本
- `pdf_content.txt` - 原始PDF内容
- `package_game.py` - 打包脚本

### 资源文件
- `assets/` - 游戏资源目录

## 运行方式

### 方法一：直接运行（推荐）
1. 双击 `运行游戏.bat` 文件
2. 游戏将在默认浏览器中打开
3. 访问地址: http://localhost:8080

### 方法二：手动运行
1. 右键点击 `index.html` 文件
2. 选择 "打开方式" -> 选择浏览器
3. 或直接拖拽到浏览器窗口

### 方法三：使用本地服务器
```bash
# 在游戏目录打开命令行
python -m http.server 8080
# 然后在浏览器访问 http://localhost:8080
```

## 游戏特色

✅ **完整实现PDF设计方案**
- 从南到北的关卡设计（高雄→台中→新竹→桃园→台北）
- 三种防御塔：岸炮、火箭炮、导弹系统
- 三种敌人：台蛙步兵、台蛙坦克、台蛙BOSS
- 完整的塔防游戏机制

✅ **现代化技术实现**
- HTML5 Canvas 游戏引擎
- 响应式界面设计
- 流畅的游戏体验
- 跨浏览器兼容

✅ **丰富的游戏内容**
- 5个精心设计的关卡
- 资源管理系统
- 敌人路径追踪
- 防御塔攻击系统

## 开发信息

- **打包时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- **游戏版本**: 1.0.0
- **技术要求**: 现代浏览器（支持HTML5）
- **文件大小**: 约 {calculate_folder_size(target_dir)} KB

## 注意事项

1. 确保浏览器支持HTML5 Canvas
2. 首次运行可能需要允许脚本执行
3. 建议使用Chrome、Firefox等现代浏览器
4. 游戏为教育娱乐性质，寓教于乐

---
**祝您游戏愉快！** 🎯
"""
    
    readme_path = os.path.join(target_dir, "游戏说明.txt")
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(readme_content)
    
    print("✓ 创建说明文件: 游戏说明.txt")

def create_run_script(target_dir):
    """创建运行脚本"""
    
    # 创建Windows批处理文件
    bat_content = """@echo off
echo 正在启动攻打台娃塔防游戏...
echo.

REM 检查Python是否可用
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 警告: 未检测到Python，将直接打开HTML文件
    echo 如需完整功能，请安装Python
    timeout /t 2
    start index.html
    exit
)

echo 启动本地服务器...
start http://localhost:8080
python -m http.server 8080

pause
"""
    
    bat_path = os.path.join(target_dir, "运行游戏.bat")
    with open(bat_path, 'w', encoding='gbk') as f:
        f.write(bat_content)
    
    print("✓ 创建运行脚本: 运行游戏.bat")

def calculate_folder_size(folder_path):
    """计算文件夹大小"""
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(folder_path):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            total_size += os.path.getsize(filepath)
    return total_size // 1024  # 转换为KB

def main():
    """主函数"""
    print("=" * 50)
    print("攻打台娃塔防游戏 - 打包程序")
    print("=" * 50)
    
    # 检查E盘是否存在
    if not os.path.exists("E:\\"):
        print("❌ E盘不存在，将尝试保存到桌面")
        # 尝试保存到桌面
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        if os.path.exists(desktop):
            target_base = desktop
        else:
            target_base = os.path.dirname(os.path.abspath(__file__))
    else:
        target_base = "E:\\"
    
    print(f"目标保存位置: {target_base}")
    print("开始打包游戏文件...\n")
    
    # 执行打包
    result_dir = create_game_package()
    
    if result_dir:
        print("\n" + "=" * 50)
        print("打包完成！")
        print("=" * 50)
        
        # 显示文件列表
        print("\n📂 打包内容:")
        for item in os.listdir(result_dir):
            item_path = os.path.join(result_dir, item)
            if os.path.isfile(item_path):
                size = os.path.getsize(item_path) // 1024
                print(f"   📄 {item} ({size} KB)")
            else:
                file_count = len([f for f in os.listdir(item_path) if os.path.isfile(os.path.join(item_path, f))])
                print(f"   📁 {item}/ ({file_count} 个文件)")
    
    input("\n按Enter键退出...")

if __name__ == "__main__":
    main()