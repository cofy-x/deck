from core_py import X_BASE_VERSION, get_core_info

def main():
    print("--- Python Service Startup ---")
    print(f"Core Version: {X_BASE_VERSION}")
    print(f"Message: {get_core_info()}")

if __name__ == "__main__":
    main()