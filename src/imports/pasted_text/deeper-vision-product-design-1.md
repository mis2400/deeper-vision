Redesign and fully expand Deeper Vision into a complete enterprise Security Engineering Operating System. The current design is missing major workflows and is too shallow. Build a full high fidelity clickable product design with all required screens, states, panels, workflows, and interactions.

The product is for security integrators, estimators, engineers, project managers, and customers. It must combine the best parts of System Surveyor, Axis Site Designer, Verkada Command, Figma, Autodesk, and a field survey app, but feel more modern, easier to use, and more intelligent.

The most important part of this product is the Engineering Designer Canvas. Do not treat it like one screen. Build every required state and workflow around it.

GLOBAL DESIGN REQUIREMENTS

Use a premium enterprise interface. It can have dark mode and light mode, but the design must not be overly black or hard to read. Create both modes if possible.

The interface should feel clean, spatial, professional, modern, calm, and precise.

Avoid giant panels blocking the map. Avoid loud coverage cones. Avoid clutter. Avoid random futuristic visuals that do not help the workflow.

The map, blueprint, or satellite view must always be the hero of the screen.

Use a collapsible left rail for main sections:
Projects
Designer
Site Walk
Device Library
BOM & Estimate
Reports
Customer Portal
Settings

Inside the Designer, use a second compact tool rail or slide-out panel for:
Site
Floors
Devices
Doors
Pathways
Network
Intelligence
Documents
Layers

The right inspector should be collapsible, resizable, and contextual. It should not permanently block the canvas.

The bottom intelligence drawer should be collapsible and should show warnings, conflicts, recommendations, labor, BOM, compliance, and deployment readiness.

Build the following screens in full detail.

SCREEN 1: LOGIN

Create a premium login page for Deeper Vision.
Include:
Email
Password
Remember device
Forgot password
SSO buttons
MFA hardware key support
Security focused branding
Light and dark mode toggle

SCREEN 2: PROJECT HUB

Create a project dashboard with:
Active projects
Pinned projects
Status cards
Search
Filters
Project type
District or client
Project phase
Open issues
Total devices
Total doors
Estimated BOM value
Team members
Recent activity
Create new project button
Open existing project button

Project cards should show:
Project name
Client
Buildings
Floors
Doors
Cameras
Access points
Issues
Progress
Last modified
Current phase

SCREEN 3: CREATE PROJECT FLOW

Create a multi step project setup wizard.

Step 1 Project Identity:
Project name
Client
End customer
Project type
Address
Sector
Campus type
Timezone
Start date
Completion goal

Step 2 Site Structure:
Campus
Buildings
Floors
Areas
Parking lots
Exterior zones
Add building
Add floor
Duplicate floor
Import floor list

Step 3 Source Material:
Upload floor plan
Use satellite address
Use VisionScan
Start blank blueprint
Import from System Surveyor
Import from CAD

Step 4 Standards:
Device standards
Preferred manufacturers
Labor assumptions
Cable standards
Network standards
Door hardware standards
Compliance profile

SCREEN 4: FLOOR PLAN IMPORT

Create a complete floor plan upload screen.

Support:
PDF
PNG
JPG
SVG
DWG
DXF

Show:
Drag and drop upload
File preview
Page selector for multi page PDF
Layer extraction
Rename floor
Assign to building
Upload progress
Import validation
Warnings for low resolution
Option to replace plan
Option to version plan

SCREEN 5: SCALE CALIBRATION

Critical screen.

User must calibrate the plan by selecting two known points.

Show:
Click point A
Click point B
Enter real distance
Example: 3 ft door width
Example: 12 ft hallway
Example: 9 ft parking stall
Scale confirmation
Scale lock
Recalibrate
Measurement overlay
Grid snapping
Scale confidence score

The UI should visually show two anchor points, a measurement line, and a scale input panel.

SCREEN 6: SATELLITE IMPORT

Create a satellite based design setup.

User enters address.
System shows satellite imagery.
User can:
Search address
Drop pin
Select property boundary
Outline building
Overlay uploaded floor plan on satellite
Adjust opacity
Rotate plan
Scale plan
Align plan to roofline
Create exterior zones
Start outdoor design

Include:
Satellite layer
Map layer
Parcel layer
Building outline layer
Outdoor pathway layer

SCREEN 7: VISIONSCAN

Create a feature called VisionScan.

This lets users walk the building with phone or tablet and generate a floor plan if they do not have one.

Screens needed:
VisionScan intro
Scan setup
Mobile scan active
Room detection
Door detection
Ceiling height detection
Ceiling type detection
Wall detection
Window detection
Hallway detection
AI cleanup
Generated floor plan review
Manual correction mode
Export to Designer

VisionScan should feel like:
Walk the site, scan the space, generate a usable floor plan.

Include:
Scan quality
Fast
Standard
Precise
LiDAR supported
Non LiDAR fallback
Room confidence
Missing wall warning
Add room label
Correct door position
Confirm ceiling type

SCREEN 8: MAIN ENGINEERING DESIGNER CANVAS

This is the core screen.

Canvas should support:
Blueprint view
Satellite view
Hybrid overlay
Blank blueprint
3D spatial mode

Core UI:
Left app rail
Compact designer tool rail
Top floating toolbar
Large central canvas
Collapsible right inspector
Collapsible bottom intelligence drawer
Mini map optional but must not block work
DORI legend optional and collapsible
Layer controls
Zoom
Pan
Select
Measure
Calibrate
Undo
Redo
Snap
Grid
Ruler
Export BOM

The canvas must be large and clean.

Device coverage should be subtle until selected.

SCREEN 9: DEVICE PALETTE

Create a modern device selection panel.

Categories:
Cameras
Readers
Locks
Intercoms
Speakers
Alarms
Sensors
Network
Power
Infrastructure

Filters:
Manufacturer
Device type
Indoor
Outdoor
NDAA
IP rating
IK rating
PoE class
Resolution
Analytics
Thermal
Fisheye
PTZ
LPR
Multisensor
Wireless
Battery powered

Manufacturers:
Axis
Verkada
Hanwha
Avigilon
Bosch
HID
Suprema
Assa Abloy
Altronix
Cisco
Aruba
Ubiquiti
LiftMaster
Schlage

Each device card should show:
Manufacturer
Model
Category
Small icon or product image
PoE draw
MSRP
Tags
Compatibility
Favorite button
Add to canvas
Drag to canvas

SCREEN 10: CAMERA PLACEMENT

Create the camera placement workflow.

User selects camera from palette.
User drags it onto canvas.
After placement:
Camera icon appears
Coverage cone appears subtly
Device label appears
Quick action bubble appears

Quick actions:
Move
Rotate
Adjust coverage
Duplicate
Change model
Add notes
Attach photo
Delete

Camera should be adjustable directly on the map with handles:
Rotate direction by dragging arc handle
Adjust distance by dragging range handle
Adjust width/FOV by dragging side handles
Move by dragging center point

Do not rely only on numeric fields.

SCREEN 11: MULTISENSOR LENS EDITOR

Critical feature.

Create a dedicated multisensor editing state.

A multisensor camera has 4 lenses:
Lens A
Lens B
Lens C
Lens D

Each lens must have:
Its own colored cone
Its own drag handles
Its own rotation handle
Its own FOV handle
Its own range handle
Its own label
Its own target simulation

Modes:
Linked lenses
Independent lenses

User should be able to:
Click Lens A and drag its cone
Click Lens B and rotate it
Click Lens C and resize coverage
Click Lens D and adjust target distance
Toggle all lenses
Hide individual lens
Reset lens
Copy lens settings
Optimize all lenses

Right inspector should show:
Model
Lens tabs
Focal length
Pan
Tilt
Height
Resolution
IR range
Pixel density
DORI result
Warnings

The map itself must show tactile manipulation handles like Axis Site Designer.

SCREEN 12: DORI AND TARGET SIMULATION

Create target simulation workflow.

User places a human target on the map.
User drags target closer or farther from camera.
System shows live preview:
Face clarity
Body visibility
Pixel density
Lighting quality
Identify
Recognize
Observe
Detect

Show a small live preview window:
Human face simulation
Low light view
IR view
Recognition quality
Distance
Pixels per foot or pixels per meter

Also support:
Vehicle target
License plate target
Crowd target

SCREEN 13: DOOR DESIGNER

Create a door placement and engineering workflow.

Door types:
Single door
Double door
Storefront
Glass door
Gate
Rollup door
Elevator door
Interior door
Exterior door

Door properties:
Width
Height
Material
Frame type
Fire rated
ADA operator
Interior/exterior
Existing/new
Reuse existing hardware
Ceiling type near door
Wall type
Power availability
Pathway access

User can drag a door onto the plan.
Door becomes an engineered object with attach points.

SCREEN 14: DOOR HARDWARE BUNDLING

Critical workflow.

Users must be able to drag hardware into the door.

Example:
Drag reader into door
Drag electric strike into door
Drag DPS into door
Drag REX into door
Drag power supply into door
Drag intercom into door
Drag maglock into door
Drag auto operator into door

The door should visually show hardware chips attached to it.

Inspector should show:
Opening details
Hardware assembly
Reader
Locking hardware
REX
Door contact
Power transfer
Power supply
Controller
Cabling
Labor
Warnings

System should warn if:
Intercom already includes reader
Reader added twice
No controller assigned
No power supply assigned
Electric strike incompatible with door
Maglock creates code concern
ADA operator missing power transfer
Fire rated door has incorrect hardware

Allow:
Dismiss warning
Accept risk
Auto fix
Swap hardware

SCREEN 15: PATHWAY ROUTING

Create cable pathway mode.

User can draw cable routes from device to IDF/MDF.

Pathway tools:
Draw route
Stop route
Add bend
Delete point
Snap to hallway
Snap to wall
Measure run
Assign cable type
Assign conduit type

Cable types:
CAT6
CAT6A
Fiber
18/2
22/6
Composite
Coax

Pathway types:
Open ceiling
Drop ceiling
Hard lid
Conduit
J hooks
Cable tray
Underground
Exterior conduit
Riser

Show:
Cable distance
Conduit fill
Labor impact
Material quantity
Pathway warnings
Bend radius warning
Max cable distance warning

Most important:
Pathway drawing must have a clear start and stop behavior.
User must be able to finish drawing without getting stuck.

SCREEN 16: IDF / MDF NETWORK ENGINEERING

Create network design workflow.

Users place:
IDF
MDF
Network rack
Switch
Patch panel
UPS
PoE injector
NVR if applicable
Cellular gateway
Wireless bridge

When devices connect:
Show live links
PoE budget
Port count
Bandwidth
Storage estimate
VLAN
IP scheme
Cable distance

Warnings:
No IDF assigned
PoE overload
Too many devices on switch
Cable exceeds 328 ft
Bandwidth too high
Retention target not met

SCREEN 17: AI SUGGEST MODE

Create Deeper Vision Suggestions.

User clicks any area on map.
System suggests:
Camera type
Mount type
Lens type
Height
Coverage angle
Reader type
Door hardware
Cable route
IDF location
Network switch
Labor estimate

Example:
User clicks parking lot.
AI recommends LPR camera, PTZ, outdoor bullet, or multisensor based on area type.

Example:
User clicks lobby.
AI recommends dome camera, reader, intercom, door contact.

Need:
AI Suggest button
Suggested devices panel
Confidence score
Reasoning
Accept suggestion
Compare options
Add to design

SCREEN 18: ENGINEERING INTELLIGENCE DRAWER

Bottom drawer with tabs:
Warnings
Conflicts
Recommendations
Labor
BOM
Compliance
Deployment

Warnings examples:
Blind spot detected
Low recognition quality
Missing IDF
No controller assigned
PoE overload
Door hardware conflict
Cable exceeds max distance
Conduit fill too high
No ceiling type selected
Camera IR range insufficient

Each issue card:
Issue title
Severity
Affected object
Reason
Suggested fix
Auto resolve
Ignore
Assign to team member

SCREEN 19: COMPLIANCE MODE

Create compliance validation screens.

Check:
ADA mounting height
Fire door hardware
Egress concerns
Maglock concerns
Power transfer
Emergency release
NDAA device filtering
Network security
Customer standards

Show pass/fail by door, device, floor, project.

SCREEN 20: SITE WALK MODE

Create mobile and desktop site walk screens.

Estimator can:
Capture photo
Record video
Voice note
Scan QR
Attach document
Attach spec sheet
Attach blueprint
Attach photo to device
Attach photo to door
Attach video to pathway

Checklist builder:
Admin creates checklists for estimators.
Estimator sees required items during walk.

Checklist examples:
Confirm ceiling type
Confirm IDF location
Confirm power availability
Confirm door condition
Confirm door frame
Confirm existing hardware
Confirm pathway
Confirm fire rating
Confirm customer IT closet access
Confirm cable route
Confirm mounting surface

SCREEN 21: DOCUMENT ATTACHMENTS

Every object must support attachments.

Objects:
Door
Camera
Reader
IDF
Pathway
Room
Building
Floor
Project

Attachments:
Photo
Video
Spec sheet
Cut sheet
Blueprint
Quote
Field note
Voice memo

Show object media gallery.

SCREEN 22: BOM AND ESTIMATE

Create live BOM page.

Sections:
Hardware
Accessories
Cabling
Network
Power
Labor
Subcontractor
Miscellaneous

Features:
Search
Filter
Group by building
Group by floor
Group by device type
Unit cost
Sell price
Margin
Labor hours
Install notes
Export PDF
Export Excel
Generate proposal

SCREEN 23: DEPLOYMENT READINESS

Create deployment page.

Show:
Ready to install
Missing info
Open issues
Material status
Labor hours
Crew size
Estimated duration
Phase plan
Floor by floor readiness
Door by door readiness

SCREEN 24: CUSTOMER PORTAL

Create customer review portal.

Customer can:
View proposal
View maps
View coverage
Comment
Request changes
Approve proposal
Download documents
See project status
See timeline
See change log

Keep it simpler than engineer view.

SCREEN 25: VERKADA COMMAND STYLE LIVE INTEGRATION

Create a live integration screen.

Show:
Device status
Online/offline
Health
Firmware
Alerts
Map view
Hardware status
Sync status

Integrations:
Verkada Command
Axis
Hanwha
Avigilon
Access control platforms

User should see:
Camera offline
Reader offline
Door forced open
Controller offline
Alarm triggered
Device health

SCREEN 26: COMPONENT LIBRARY ADMIN

Admin can manage approved products.

Features:
Add device
Edit device specs
Upload cut sheet
Set MSRP
Set labor units
Set compatibility rules
Set preferred manufacturer
Set discontinued flag
Set standard kit

Compatibility rules:
Reader works with controller
Camera PoE class
Intercom includes reader
Lock requires power supply
Wireless lock requires gateway
Door operator requires power transfer

SCREEN 27: SETTINGS

Settings should include:
User profile
Company profile
Roles and permissions
Standards templates
Labor rates
Manufacturer preferences
Integrations
Data export
Security settings
Appearance
Accessibility

SCREEN 28: HELP AND SHORTCUTS

Create help center:
Keyboard shortcuts
How to place device
How to scale plan
How to adjust multisensor
How to draw pathway
How to bundle door hardware
How to resolve warnings

FINAL REQUIREMENT

Do not create only 8 or 9 generic pages.

Create a full product prototype with separate screens for each major workflow and each key interaction state.

The Engineering Designer must be shown in multiple states:
Empty state
Floor plan upload state
Satellite state
Scale calibration state
Device palette open
Camera selected
Multisensor selected
Door selected
Hardware bundle selected
Pathway drawing
IDF selected
AI suggestion mode
Warnings open
BOM preview open
Customer review mode

Make the final design feel like a real product ready to hand to Claude for implementation.