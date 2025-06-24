import os
import time

from playwright.sync_api import expect, sync_playwright


def test_login_and_dashboard_actions():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={"width": 1280, "height": 1000})
        page = context.new_page()

        page.goto("http://auth.dev.locust.cloud")

        page.fill('input[name="email"]', os.environ["LOCUSTCLOUD_USERNAME"])
        page.fill('input[name="password"]', os.environ["LOCUSTCLOUD_PASSWORD"])

        page.click('button[type="submit"]')

        # skip dashboard tutorial
        page.get_by_text("Skip").click()

        with context.expect_page() as url_test_page_info:
            page.get_by_text("Run in Browser").click()

        url_test_page = url_test_page_info.value
        url_test_page.wait_for_load_state()

        # skip locust tutorial
        url_test_page.get_by_text("Skip").click()

        # Select the mock target class for this test run
        url_test_page.get_by_text("Mock Target").click()

        button = url_test_page.locator("button[type='submit']")
        expect(button).to_be_enabled(timeout=45000)
        button.click()

        # Let the test run
        time.sleep(10)

        # Stop the test
        url_test_page.get_by_text("Stop").click()

        # Wait for the test to have stopped and the new button to appear
        button = url_test_page.locator('button:has-text("New")')
        button.wait_for(state="visible", timeout=10000)

        browser.close()
