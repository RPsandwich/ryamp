import { useState } from 'react';
import { EDITABLE_COLOR_KEYS, type EditableThemeColors } from '../skins/customThemes';
import { THEMES } from '../skins/themes';

interface ThemeCreatorProps {
  // Starting point for the color pickers -- defaults to the currently
  // active theme's colors (built-in or custom) so creating a theme feels
  // like "tweak what I've got" rather than starting from scratch every time.
  initialColors: EditableThemeColors;
  onSave: (name: string, colors: EditableThemeColors) => void;
  onClose: () => void;
}

const DEFAULT_COLORS: EditableThemeColors = {
  accentMagenta: THEMES[0].colors.accentMagenta,
  accentCyan: THEMES[0].colors.accentCyan,
  accentViolet: THEMES[0].colors.accentViolet,
  borderViolet: THEMES[0].colors.borderViolet,
  bgVoid: THEMES[0].colors.bgVoid,
  bgPanel: THEMES[0].colors.bgPanel,
  bgPanelRaised: THEMES[0].colors.bgPanelRaised,
  bgScreen: THEMES[0].colors.bgScreen,
};

export function ThemeCreator({ initialColors, onSave, onClose }: ThemeCreatorProps) {
  const [colors, setColors] = useState<EditableThemeColors>(initialColors ?? DEFAULT_COLORS);
  const [name, setName] = useState('');

  const setColor = (key: keyof EditableThemeColors, value: string) => {
    setColors((c) => ({ ...c, [key]: value }));
  };

  const canSave = name.trim().length > 0;

  return (
    <div className="panel" style={{ marginTop: '0.5rem', padding: '0.6rem' }}>
      <div className="section-label">Create Theme</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.6rem' }}>
        {EDITABLE_COLOR_KEYS.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/*
              The native <input type="color"> is still what opens the OS
              color-wheel picker on click -- but its own rendered swatch
              varies in apparent size/border depending on how dark the
              color is (a WebView2 quirk), so it's made fully transparent
              and layered on top of a plain div that we fully control,
              guaranteeing every row's swatch is the same square regardless
              of color value.
            */}
            <div
              style={{
                position: 'relative',
                width: '1.6rem',
                height: '1.6rem',
                flexShrink: 0,
                borderRadius: '3px',
                border: '1px solid var(--border-violet)',
                background: colors[key],
                overflow: 'hidden',
              }}
            >
              <input
                type="color"
                value={colors[key]}
                onChange={(e) => setColor(key, e.target.value)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  padding: 0,
                  border: 'none',
                  opacity: 0,
                  cursor: 'pointer',
                }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', flex: 1 }}>{label}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{colors[key]}</span>
          </div>
        ))}
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Theme name"
        style={{ width: '100%', marginBottom: '0.5rem' }}
      />

      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button
          className="btn-retro"
          disabled={!canSave}
          onClick={() => {
            if (!canSave) return;
            onSave(name.trim(), colors);
          }}
          style={{ flex: 1 }}
        >
          Save Theme
        </button>
        <button className="btn-retro" onClick={onClose} style={{ flex: 1 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
