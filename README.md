# forecast_data_overlay

## About

Tool for displaying varying types of forecast data simultaneously.

Initially produced by downsizing the functionality found in the [NGIAB_data_preprocess](https://github.com/CIROH-UA/NGIAB_data_preprocess) repository to just the map application and data request functionality.

## Setup

The setup for this project is largely identical to the uv-specific installation of the [NGIAB_data_preprocess](https://github.com/CIROH-UA/NGIAB_data_preprocess), with the caveat that this project is not currently a package and cannot be automatically installed.

1. Clone the repository:

    ```bash
    git clone CIROH-UA/forecast_data_overlay
    ```
2. Navigate to the project directory:

    ```bash
    cd forecast_data_overlay
    ```
3. Set up uv tool as per instructions in the [NGIAB_data_preprocess readme](https://github.com/CIROH-UA/NGIAB_data_preprocess?tab=readme-ov-file#for-uv-installation).

    ```bash
    # Install UV
    curl -LsSf https://astral.sh/uv/install.sh | sh
    # It can be installed via pip if that fails
    # pip install uv
    ```
4. Set up the project with uv:

    ```bash
    uv venv
    uv sync
    ```

## Running the Application

After setting up the project with uv, you can run the map application module using:

```bash
uv run modules/map_app
```

Then, open your web browser and navigate to one of the links provided in the terminal output (e.g., `http://127.0.0.1:8080`).

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.