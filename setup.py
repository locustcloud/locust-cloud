from setuptools import setup, find_packages

setup(
    name="locust_cloud",
    version="1.0.0",
    description="Locust plugins for members of Locust Cloud",
    packages=find_packages(),
    install_requires=[
        "locust>=2.22.0",
    ],
    python_requires=">=3.8",
)
