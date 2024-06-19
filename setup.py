from setuptools import find_packages, setup

setup(
    name="locust-cloud",
    version="1.0.0",
    description="Locust plugins for members of Locust Cloud",
    packages=find_packages(include=["locust_cloud", "kubernetes_client"]),
    install_requires=[
        "locust>=2.22.0",
        "botocore>=1.34.118",
        "kubernetes>=29.0.0",
    ],
    python_requires=">=3.8",
    entry_points={
        "console_scripts": [
            "locust-cloud=locust_cloud.main:main",
        ],
    },
)
