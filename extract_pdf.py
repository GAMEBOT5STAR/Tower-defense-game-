#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
PDF内容提取脚本
用于读取游戏开发思路PDF文件并提取文本内容
"""

import PyPDF2
import os

def extract_pdf_content(pdf_path):
    """
    提取PDF文件中的文本内容
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(pdf_path):
            return f"错误：文件不存在 - {pdf_path}"
        
        # 打开PDF文件
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            # 检查PDF是否加密
            if pdf_reader.is_encrypted:
                return "错误：PDF文件已加密，无法读取"
            
            # 提取所有页面的文本
            text_content = ""
            total_pages = len(pdf_reader.pages)
            
            for page_num in range(total_pages):
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                text_content += f"=== 第 {page_num + 1} 页 ===\n{text}\n\n"
            
            return text_content
            
    except Exception as e:
        return f"读取PDF时出错：{str(e)}"

def main():
    """主函数"""
    pdf_path = r"C:/Users/HP/OneDrive/桌面/项目/游戏开发思路.pdf"
    
    print("正在提取PDF内容...")
    content = extract_pdf_content(pdf_path)
    
    # 保存提取的内容
    output_file = "pdf_content.txt"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"内容已保存到: {output_file}")
    print("\n" + "="*50)
    print("提取的内容：")
    print("="*50)
    print(content)
    
    return content

if __name__ == "__main__":
    main()