Perfect. Tell Figma this exactly:

You are correct that many base screens now exist. The next phase is NOT adding more generic pages. The next phase is deepening the core workflows and making Deeper Vision feel like a real enterprise engineering operating system instead of static UI concepts.

Focus ONLY on the following high priority workflows and expand them in extreme detail with multiple interaction states, overlays, modals, transitions, floating controls, contextual actions, and engineering logic.

This phase should feel like a real production grade system.

PRIORITY 1 — ENGINEERING DESIGNER STATES

The Engineering Designer is still the most important area of the product and needs much more depth.

Create dedicated screens and interaction states for:

1. Empty canvas state
   No blueprint loaded
   Prompt options:
   Upload blueprint
   Use satellite
   Use VisionScan
   Start blank
   Import CAD
   Import from Surveyor

2. Floorplan loaded state
   Scaled correctly
   Layer controls
   Grid overlay
   Opacity controls
   Blueprint alignment tools

3. Satellite + blueprint hybrid mode
   Satellite underlay
   Blueprint overlay
   Opacity slider
   Roofline alignment
   Exterior camera planning
   Parking lot coverage planning
   Fence line protection
   Gate coverage

4. Camera placement interaction
   Camera selected directly on map
   Floating radial actions:
   Rotate
   Adjust FOV
   Duplicate
   Delete
   Swap model
   Add note
   Add photo
   Open intelligence

5. Direct manipulation handles
   THIS IS CRITICAL.
   Do not force numeric-only editing.

Users must adjust cameras directly on canvas:
Drag center point to move
Drag arc to rotate
Drag outer handle to extend range
Drag side handles to widen or narrow FOV

Show smooth interaction states.

6. Multisensor editing mode
   Create a FULL workflow for multisensor cameras.

Each lens must have:
Independent color
Independent cone
Independent drag handles
Independent rotation
Independent range
Independent FOV
Independent target simulation

Show:
Linked mode
Independent mode
Auto optimize mode

Need multiple screens:
Lens A selected
Lens B selected
All lenses selected
Conflict state
Blind spot state
Optimization recommendation state

7. Target simulation
   Critical workflow.

User drags a human target around the map.

As target moves:
Live face preview updates
Pixel density updates
DORI classification updates
Recognition quality changes
Lighting quality changes

Need:
Day mode
Night mode
IR mode
Low light mode

Show realistic previews similar to Axis Site Designer but more premium.

8. Coverage visibility improvements
   Current coverage cones are too loud.

Create:
Soft opacity mode
Selected device highlight mode
Coverage isolation mode
Toggle all coverage off
Coverage fade when zoomed out
Selected device priority visibility

Canvas should remain readable even with many devices.

9. Intelligence drawer
   Create expandable bottom drawer states:
   Collapsed
   Half expanded
   Full expanded

Tabs:
Warnings
Conflicts
Recommendations
Labor
BOM
Compliance
Deployment

Each issue card should support:
Assign
Ignore
Auto resolve
View affected devices
Open pathway
Swap hardware

PRIORITY 2 — DOOR & ACCESS CONTROL ENGINEERING

Build a complete access control engineering workflow.

1. Door placement
   Drag doors onto plan:
   Single
   Double
   Storefront
   Glass
   Rollup
   Gate
   Elevator

2. Hardware bundling
   Critical feature.

User must drag hardware INTO the door object.

Examples:
Reader
Strike
Maglock
DPS
REX
Power transfer
Intercom
Auto operator
Controller

Show visual hardware chips attached to the door.

3. Door intelligence
   System warns:
   Intercom already has reader
   Missing DPS
   Fire rated conflict
   No power supply
   Incorrect electrification
   ADA issue
   Maglock egress issue

4. Door detail panel
   Show:
   Door width
   Material
   Frame type
   Fire rating
   Existing/new
   Opening type
   Electrification
   Reader type
   Controller assignment
   Labor estimate
   Compliance status

5. Reader mounting visualization
   Wall mount
   Mullion
   Pedestal
   Door frame
   Glass mount

Show actual visual placement around the door.

PRIORITY 3 — PATHWAY & NETWORK ENGINEERING

Create a full pathway routing system.

1. Pathway drawing
   User clicks:
   Start route
   Add bends
   Snap to hallway
   Snap to wall
   End route cleanly

Current UX gets stuck. Fix that.

2. Cable visualization
   CAT6
   Fiber
   18/2
   22/6
   Conduit
   J hooks
   Tray

3. IDF/MDF workflow
   Place:
   IDF
   MDF
   Switch
   Rack
   UPS
   Patch panel

4. Live network calculations
   PoE usage
   Port usage
   Bandwidth
   Storage
   Cable distance
   Conduit fill

5. Conflict states
   PoE overload
   Distance exceeded
   Conduit fill exceeded
   No switch assigned
   No pathway assigned

PRIORITY 4 — LIVE INTEGRATION MODE

Build the Verkada Command inspired live monitoring workflow.

Need:
Live device health map
Online/offline states
Door forced open
Reader offline
Camera offline
Firmware warning
Power issue
Live sync indicator

Create:
Live monitoring dashboard
Map alert mode
Device detail flyout
Alert timeline
Event playback concept

PRIORITY 5 — COMPONENT LIBRARY ADMIN

Build enterprise component management.

Screens:
Device library
Manufacturer management
Compatibility rules
Labor unit configuration
MSRP management
Approved product standards

Show:
Manufacturer cards
Search
Advanced filters
Compatibility matrices
Favorite templates
Standard kits

PRIORITY 6 — HELP SYSTEM

Build:
Interactive onboarding
Keyboard shortcuts
Tooltips
Guided walkthroughs
Training overlays
Estimator onboarding mode

Need onboarding for:
Camera placement
Multisensor editing
Door bundling
Pathway routing
Scaling
Target simulation

PRIORITY 7 — CREATE PROJECT WIZARD

Expand the project setup experience.

Need:
Campus builder
Building hierarchy
Floor assignment
Template presets
Scaling setup
Blueprint import
Satellite import
VisionScan initiation

Show all onboarding steps visually.

IMPORTANT VISUAL DIRECTION

Do NOT create random futuristic visuals.

The product should feel:
Professional
Clean
Precise
Spatial
Enterprise
Premium
Modern

Use:
Soft glows
Minimal gradients
Thin lines
Controlled color usage
Readable typography
Large working canvas

Avoid:
Huge blocking sidebars
Overwhelming neon
Oversized coverage cones
Heavy clutter
Tiny unreadable text

FINAL REQUIREMENT

Every workflow should feel implementable and realistic.

Do not make static marketing screens.

Make production-grade product design screens with:
Hover states
Selection states
Drag states
Expanded panels
Collapsed panels
Modal overlays
Conflict states
Warnings
Tooltips
Loading states
Empty states
AI recommendation states
Real engineering logic

The goal is for Claude to use these designs as implementation-ready references for a real software platform.
