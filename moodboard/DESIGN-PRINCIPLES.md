# OKNO Design Principles
## Extracted from Moodboard References

### Core Aesthetic
**Soft Neumorphism + Scandinavian Minimalism**

### Color Palette
```css
/* Base Colors */
--bg-primary: #F0F0F3;      /* Neumorphic background */
--bg-secondary: #E8E6E0;    /* Eggshell variant */
--eucalyptus: #8FB5A5;      /* Primary brand color */
--eucalyptus-dark: #7DA594;
--coral-accent: #FF9A8B;    /* Warm accent for interactions */
--text-primary: #4A5A52;
--text-secondary: #7A9487;

/* Neumorphic Shadow Colors */
--light-shadow: #FFFFFF;
--dark-shadow: rgba(174, 174, 192, 0.4);
--dark-shadow-inner: rgba(174, 174, 192, 0.25);
```

### Shadow System

#### Raised Elements (buttons, cards)
```css
box-shadow:
  -10px -10px 30px var(--light-shadow),
  10px 10px 30px var(--dark-shadow);
```

#### Sunken Elements (inputs, active states)
```css
box-shadow:
  inset -10px -10px 10px var(--dark-shadow-inner),
  inset 10px 10px 10px var(--light-shadow);
```

#### Floating Elements (modals, dropdowns)
```css
box-shadow:
  0 20px 60px rgba(143, 181, 165, 0.3),
  inset 0 1px 2px rgba(255, 255, 255, 0.5);
```

### Component Patterns

#### Buttons
- **Default**: Raised with dual shadows
- **Hover**: Slightly higher elevation (increase shadow blur)
- **Active**: Sunken with inset shadows
- **Primary**: Eucalyptus gradient with raised shadows
- **Secondary**: Neutral with soft shadows

#### Input Fields
- Sunken appearance with inset shadows
- Icon on left (subtle color)
- Placeholder text in soft gray
- Focus: Inner glow in eucalyptus

#### Toggle Switches
- Background: Sunken track
- Handle: Raised circle with dual shadows
- Active state: Eucalyptus background
- Smooth transition: 300ms cubic-bezier

#### Cards/Panels
- Raised from background with soft shadows
- Border-radius: 16-24px
- Backdrop blur for floating panels
- Subtle inner highlight on top edge

#### Navigation Pills
- Inactive: Flat or slightly raised
- Active: Sunken with color fill
- Hover: Subtle shadow increase
- Smooth morphing between states

### Typography
- **Headings**: 300-400 weight, tight spacing (-0.02em)
- **Body**: 400-500 weight, relaxed line-height (1.6)
- **Labels**: 500 weight, uppercase with letter-spacing (0.05em)
- **Gradient Text**: Subtle gradient for emphasis

### Animation Principles
- **Easing**: cubic-bezier(0.4, 0, 0.2, 1) - "Ease out expo"
- **Duration**: 300ms for interactions, 600ms for major transitions
- **Float/Pulse**: 4-6s infinite for ambient animations
- **Hover**: Immediate response (<100ms)
- **Shadow Growth**: Subtle blur increase on hover

### Interaction States
1. **Rest**: Raised with standard shadows
2. **Hover**: Shadow blur +10px, translate Y -2px
3. **Active/Pressed**: Sunken, inset shadows, translate Y +1px
4. **Focus**: Eucalyptus glow ring (0 0 0 3px rgba(143, 181, 165, 0.3))
5. **Disabled**: Reduced opacity (0.5), no shadows

### Spacing System
- **Base unit**: 8px
- **Micro**: 4px (tight groupings)
- **Small**: 8px (related elements)
- **Medium**: 16px (component padding)
- **Large**: 24px (section spacing)
- **XL**: 40px (major sections)

### Layout Principles
- **Center-focused**: Key actions in center or golden ratio
- **Breathing room**: Generous whitespace (40-60px margins)
- **Grouped controls**: Related buttons in rounded containers
- **Floating panels**: Controls float above content with backdrop blur
- **Symmetry**: Balanced layouts with clear visual hierarchy

### Accessibility
- **Color contrast**: WCAG AA minimum (4.5:1 for text)
- **Focus indicators**: Always visible (eucalyptus ring)
- **Touch targets**: Minimum 44x44px
- **Motion**: Respect prefers-reduced-motion
- **Keyboard nav**: All interactive elements accessible

### Mobile Considerations
- **Touch-friendly**: Larger hit areas (48x48px minimum)
- **Simplified shadows**: Reduce complexity on mobile
- **Backdrop blur**: Fallback for unsupported devices
- **Responsive sizing**: Fluid typography (clamp())

### References
- Image 1: Notification dashboard with neumorphic cards
- Image 2: Sign-up form with clean inputs and social login
- Image 3: Tab navigation with pill design
- Image 4: Pinterest board showing neumorphic UI kits
- Image 5: Neumorphism shadow formula breakdown
