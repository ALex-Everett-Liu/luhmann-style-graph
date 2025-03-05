// Theme Customization Module
const themeModule = (function() {
    // Create theme settings section in the UI
    const createThemeSettings = () => {
        // Check if theme settings already exist
        if (document.getElementById('theme-settings')) return;
        
        // Create theme settings container
        const themeSettings = document.createElement('div');
        themeSettings.id = 'theme-settings';
        themeSettings.className = 'theme-settings card';
        
        // Add theme settings content
        themeSettings.innerHTML = `
            <h3>Theme Settings</h3>
            <div class="color-picker-container">
                <label for="accent-color">Accent Color:</label>
                <input type="color" id="accent-color" value="#2196f3">
                <button id="apply-theme" class="theme-button">Apply Theme</button>
                <button id="reset-theme" class="theme-button secondary">Reset</button>
            </div>
            <div class="theme-presets">
                <h4>Presets:</h4>
                <div class="color-presets">
                    <button class="color-preset" data-color="#2196f3" style="background-color: #2196f3;"></button>
                    <button class="color-preset" data-color="#4caf50" style="background-color: #4caf50;"></button>
                    <button class="color-preset" data-color="#ff5722" style="background-color: #ff5722;"></button>
                    <button class="color-preset" data-color="#9c27b0" style="background-color: #9c27b0;"></button>
                    <button class="color-preset" data-color="#ff9800" style="background-color: #ff9800;"></button>
                    <button class="color-preset" data-color="#607d8b" style="background-color: #607d8b;"></button>
                </div>
            </div>
        `;
        
        // Add theme settings styles
        const themeStyles = document.createElement('style');
        themeStyles.textContent = `
            .theme-settings {
                margin-top: 20px;
                padding: 15px;
                background-color: white;
                border-radius: var(--radius);
                box-shadow: var(--shadow);
            }
            
            .theme-settings h3 {
                margin-top: 0;
                margin-bottom: 15px;
                font-size: 16px;
            }
            
            .color-picker-container {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 15px;
                flex-wrap: wrap;
            }
            
            .color-picker-container label {
                font-weight: 500;
            }
            
            .theme-button {
                padding: 6px 12px;
                border-radius: var(--radius);
                cursor: pointer;
            }
            
            .theme-button.secondary {
                background-color: var(--light-gray);
                color: var(--text-color);
            }
            
            .theme-presets h4 {
                margin-top: 0;
                margin-bottom: 10px;
                font-size: 14px;
            }
            
            .color-presets {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .color-preset {
                width: 30px;
                height: 30px;
                border-radius: 50%;
                border: 2px solid white;
                cursor: pointer;
                box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
                transition: transform 0.2s;
            }
            
            .color-preset:hover {
                transform: scale(1.1);
            }
            
            .color-preset.active {
                border: 2px solid black;
            }
        `;
        document.head.appendChild(themeStyles);
        
        // Find a good place to add the theme settings
        const formsContainer = document.querySelector('.forms-container');
        if (formsContainer) {
            formsContainer.appendChild(themeSettings);
        } else {
            // Fallback - add after the filter section
            const filterSection = document.getElementById('filterSection');
            if (filterSection) {
                filterSection.parentNode.insertBefore(themeSettings, filterSection.nextSibling);
            } else {
                // Last resort - add at the end of the body
                document.body.appendChild(themeSettings);
            }
        }
        
        // Add event listeners
        document.getElementById('apply-theme').addEventListener('click', applyTheme);
        document.getElementById('reset-theme').addEventListener('click', resetTheme);
        
        // Add event listeners to color presets
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.getAttribute('data-color');
                document.getElementById('accent-color').value = color;
                applyTheme();
                
                // Update active state
                document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
            });
        });
        
        // Load saved theme if available
        loadSavedTheme();
    };
    
    // Apply the selected theme
    const applyTheme = () => {
        const accentColor = document.getElementById('accent-color').value;
        
        // Generate darker shade for hover states
        const darkerShade = adjustColor(accentColor, -20);
        
        // Create CSS variables
        const root = document.documentElement;
        root.style.setProperty('--primary-color', accentColor);
        root.style.setProperty('--primary-dark', darkerShade);
        
        // Save theme to localStorage
        localStorage.setItem('zettelkasten-theme-accent', accentColor);
        
        // Update active preset
        document.querySelectorAll('.color-preset').forEach(preset => {
            if (preset.getAttribute('data-color') === accentColor) {
                preset.classList.add('active');
            } else {
                preset.classList.remove('active');
            }
        });
    };
    
    // Reset theme to default
    const resetTheme = () => {
        const defaultColor = '#2196f3';
        document.getElementById('accent-color').value = defaultColor;
        
        const root = document.documentElement;
        root.style.setProperty('--primary-color', defaultColor);
        root.style.setProperty('--primary-dark', '#1976d2');
        
        // Clear saved theme
        localStorage.removeItem('zettelkasten-theme-accent');
        
        // Update active preset
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.classList.remove('active');
            if (preset.getAttribute('data-color') === defaultColor) {
                preset.classList.add('active');
            }
        });
    };
    
    // Load saved theme from localStorage
    const loadSavedTheme = () => {
        const savedAccent = localStorage.getItem('zettelkasten-theme-accent');
        if (savedAccent) {
            document.getElementById('accent-color').value = savedAccent;
            applyTheme();
        } else {
            // Set default as active
            const defaultPreset = document.querySelector('.color-preset[data-color="#2196f3"]');
            if (defaultPreset) defaultPreset.classList.add('active');
        }
    };
    
    // Helper function to adjust color brightness
    const adjustColor = (color, amount) => {
        return '#' + color.replace(/^#/, '').replace(/../g, color => {
            const value = Math.min(255, Math.max(0, parseInt(color, 16) + amount));
            return value.toString(16).padStart(2, '0');
        });
    };
    
    // Initialize theme settings
    const initialize = () => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createThemeSettings);
        } else {
            createThemeSettings();
        }
    };
    
    // Public API
    return {
        initialize,
        applyTheme,
        resetTheme
    };
})();

// Export the module
window.themeModule = themeModule; 