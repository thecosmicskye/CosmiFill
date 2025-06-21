from setuptools import setup, find_packages

with open("requirements.txt") as f:
    requirements = f.read().splitlines()

setup(
    name="cosmifill",
    version="1.0.0",
    description="Automated PDF form filling tool",
    author="CosmiFill",
    packages=find_packages(),
    install_requires=requirements,
    entry_points={
        'console_scripts': [
            'cosmifill=cosmifill.cli:cosmifill',
        ],
    },
    python_requires='>=3.8',
)