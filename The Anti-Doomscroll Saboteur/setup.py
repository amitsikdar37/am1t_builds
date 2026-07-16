"""
Instagram Cookie Setup — run this ONCE.

This opens a fresh Chrome window, you log into Instagram manually,
then press Enter. Your session cookies are saved to cookies.json.

After this you never need to run setup.py again (until cookies expire
in ~90 days).

RUN:
    .\\venv\\Scripts\\python.exe setup.py
"""

import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

print("=" * 55)
print("  Instagram Cookie Setup")
print("=" * 55)
print()
print("1. A Chrome window will open.")
print("2. Log into Instagram completely.")
print("3. Come back here and press Enter.")
print()

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
driver.get("https://www.instagram.com/")

input("   >> Press Enter AFTER you have logged into Instagram: ")

cookies = driver.get_cookies()
with open("cookies.json", "w") as f:
    json.dump(cookies, f, indent=2)

print()
print(f"[OK] Saved {len(cookies)} cookies to cookies.json")
print("[OK] You can now run: .\\venv\\Scripts\\python.exe saboteur.py")
driver.quit()
