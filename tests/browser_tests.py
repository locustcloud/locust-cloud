import os
import time

import pytest
import requests
from playwright.sync_api import expect, sync_playwright

HEADLESS = bool(os.environ.get("HEADLESS", False))


def do_url_test(page, _context):
    # skip dashboard tutorial
    page.get_by_text("Skip").click()
    time.sleep(5)

    page.get_by_text("Run in Browser").click()

    # skip locust tutorial
    page.get_by_text("Skip").click()

    # Select the mock target class for this test run
    page.get_by_text("Mock Target").click()

    button = page.locator("button[type='submit']")
    expect(button).to_be_enabled(timeout=80000)
    button.click()

    # Let the test run
    time.sleep(20)

    # Stop the test
    page.get_by_text("Stop").click()

    # Wait for the test to have stopped and the new button to appear
    button = page.locator('button:has-text("New")')
    button.wait_for(state="visible", timeout=10000)


def do_signup(region):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        context = browser.new_context(viewport={"width": 1280, "height": 1000})
        page = context.new_page()

        page.goto("http://auth.locust.cloud/signup")

        # sleeps are to avoid getting flagged by recaptcha
        page.fill('input[name="email"]', f"andrew+{region}_signup_test@locust.cloud")
        time.sleep(1)
        page.fill('input[name="customer_name"]', f"{region} signup test")
        time.sleep(1)
        page.fill('input[name="company_name"]', f"{region} signup test")
        time.sleep(1)
        page.select_option('select[name="region"]', region)
        time.sleep(1)
        page.fill('input[name="password"]', os.environ["LOCUSTCLOUD_PASSWORD"])
        time.sleep(1)
        page.check('input[name="consent"]')
        time.sleep(1)
        page.click('button[type="submit"]')
        time.sleep(10)

        # allow verification code to be manually entered
        page.wait_for_selector("text=Select a Plan", timeout=80000)
        page.get_by_text("Continue with Free Tier").click()

        id_token = next((cookie.get("value") for cookie in context.cookies() if cookie.get("name") == "id_token"), None)

        do_url_test(page, context)

        lambda_url = "https://api.locust.cloud" if region == "US" else "https://api.eu-north-1.locust.cloud"
        requests.delete(f"{lambda_url}/1/delete-account", headers={"Authorization": f"Bearer {id_token}"})

        browser.close()


@pytest.mark.skipif(HEADLESS, reason="verification code needs to be entered manually")
def test_signup_eu():
    do_signup(region="EU")


@pytest.mark.skipif(HEADLESS, reason="verification code needs to be entered manually")
def test_signup_us():
    do_signup(region="US")


def test_login_and_dashboard_actions():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        context = browser.new_context(viewport={"width": 1280, "height": 1000})
        page = context.new_page()

        page.goto("http://auth.dev.locust.cloud")

        page.fill('input[name="email"]', os.environ["LOCUSTCLOUD_USERNAME"])
        page.fill('input[name="password"]', os.environ["LOCUSTCLOUD_PASSWORD"])
        page.select_option('select[name="region"]', "EU")

        page.click('button[type="submit"]')
        time.sleep(10)

        do_url_test(page, context)

        browser.close()
