import os
import json
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options as ChromeOptions

def run_test():
    # 1. Load debtors from JSON
    json_path = os.path.join(os.getcwd(), 'debtors.json')
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            debtors = json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find {json_path}. Please create the debtors.json file.")
        return

    # 2. Setup Chrome and persistent profile
    options = ChromeOptions()
    # This keeps the browser open after the script completes or crashes
    options.add_experimental_option("detach", True)
    
    # Save your Chrome profile so you stay logged in!
    profile_path = os.path.join(os.getcwd(), "chrome_profile")
    options.add_argument(f"user-data-dir={profile_path}")
    
    driver = webdriver.Chrome(options=options)
    
    wait_long = WebDriverWait(driver, 60) 
    wait_short = WebDriverWait(driver, 10)
    
    print("IMPORTANT: If Instagram asks you to log in, please do so manually in the browser. The script will wait up to 60 seconds for the first post to load.")
    
    # 3. Loop over all debtors
    for debtor in debtors:
        amount_owed = debtor.get("amount_owed", 0)
        username = debtor.get("username", "Unknown")
        
        # Only process debtors who owe > 0
        if amount_owed > 0:
            target_url = debtor.get("instagram_url")
            message = debtor.get("message")
            
            print(f"\n==========================================")
            print(f"Processing debtor: {username} (Owes: ₹{amount_owed})")
            print(f"Navigating to: {target_url}")
            
            try:
                driver.get(target_url)
                
                # Wait for and click the first post
                first_post_selector = "a[href*='/p/']"
                first_post = wait_long.until(EC.presence_of_element_located((By.CSS_SELECTOR, first_post_selector)))
                
                print("Found the latest post! Clicking it...")
                driver.execute_script("arguments[0].click();", first_post)
                
                # Wait for the comment text area to appear in the post modal
                print("Waiting for the comment box to load...")
                time.sleep(4) 
                
                comment_box_selector = "textarea[aria-label='Add a comment…'], textarea[placeholder='Add a comment…']"
                comment_box = wait_short.until(EC.presence_of_element_located((By.CSS_SELECTOR, comment_box_selector)))
                
                # Click the comment box to focus it using Javascript
                driver.execute_script("arguments[0].click();", comment_box)
                time.sleep(2)
                
                # Type the comment
                print(f"Typing message: '{message}'")
                comment_box = wait_short.until(EC.presence_of_element_located((By.CSS_SELECTOR, comment_box_selector)))
                comment_box.send_keys(message)
                time.sleep(2) 
                
                # Submit the comment by clicking the Post button
                print("Submitting comment...")
                post_button_xpath = "//*[text()='Post' and @role='button'] | //button[text()='Post'] | //div[text()='Post']"
                try:
                    post_button = wait_short.until(EC.element_to_be_clickable((By.XPATH, post_button_xpath)))
                    driver.execute_script("arguments[0].click();", post_button)
                    print("Clicked the Post button!")
                except Exception:
                    print("Could not find the 'Post' button, attempting to press Enter...")
                    comment_box.send_keys(Keys.ENTER)
                    
                print(f"Successfully posted to {username}'s profile!")
                
                # Small pause before moving to the next person
                time.sleep(3)
                
            except Exception as e:
                print(f"Failed to process {username}. An error occurred: {e}")
        else:
            print(f"\nSkipping {username} because they owe ₹{amount_owed}.")

    print("\n==========================================")
    print("Script finished processing all debtors.")

if __name__ == "__main__":
    run_test()
