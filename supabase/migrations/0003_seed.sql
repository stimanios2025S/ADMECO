insert into ateliers(id, code, name, site) values
(1, 'A1', 'Atelier 1 - Primary Woodworking & Slicing', 'SITE_A'),
(2, 'A2', 'Atelier 2 - Structural Assembly & Metalwork', 'SITE_A'),
(3, 'B3', 'Atelier 3 - Finishing, Upholstery & Final QC', 'SITE_B')
on conflict (id) do nothing;

insert into product_categories(name, description) values
('Chairs', 'Dining / office chairs, wood + metal'),
('Dining Tables', 'Solid wood tables'),
('Cabinets', 'Storage cabinets'),
('Armchairs', 'Upholstered armchairs')
on conflict (name) do nothing;

create temp table master_steps(step_order int, atelier_id smallint, step_name text, est int, mat text, qty numeric) on commit drop;
insert into master_steps values
(1,1,'Timber Inspection & Moisture Verification',20,'Raw Timber m3',0.05),
(2,1,'Rip-Sawing & Board Slicing',45,'Boards pcs',4),
(3,1,'Surface Planing & Thicknessing',30,'Boards pcs',4),
(4,1,'CNC Precision Cutting & Profiling',60,'Panels pcs',8),
(5,1,'Joinery Mortising & Tenoning',40,'Joints set',1),
(6,1,'Edge Banding & Milling',35,'Edgeband m',12),
(7,1,'Rough Surface Sanding',25,'Sandpaper sheet',2),
(8,1,'Component Batch Defect Audit',15,'Checklist',1),
(9,1,'Sub-Assembly Parts Sorting',20,'Bins',1),
(10,1,'Zone A Dispatch Staging & QR Labeling',15,'QR Label',1),
(11,2,'Steel Tube Slicing & Deburring',30,'Steel tube m',6),
(12,2,'Frame Bending & MIG/TIG Welding',50,'Welding wire kg',0.3),
(13,2,'Weld Grinding & Metal Polish',25,'Grinding disc',1),
(14,2,'Wood-to-Metal Joinery Integration',40,'Assembly kit',1),
(15,2,'Structural Rigidity & Load Testing',15,'Test cycle',1),
(16,2,'Hardware Fastener Installation',20,'Screws/bolts set',12),
(17,2,'Frame Gluing & Hydraulic Clamping',45,'Wood glue L',0.5),
(18,2,'Intermediate Quality Check',15,'Checklist',1),
(19,2,'Inter-Site Shipping QR Manifesting',10,'Pallet',1),
(20,2,'Transit Container Loading & Departure',20,'Container',1),
(21,3,'Site B Receiving QR Scan & Transfer Audit',15,'Manifest',1),
(22,3,'Fine Surface Sanding & Dust Extraction',30,'Fine sandpaper',3),
(23,3,'Primer & Stain Coat Application',40,'Primer L',0.8),
(24,3,'UV/Lacquer Spray Booth Topcoating',45,'Lacquer L',1),
(25,3,'Curing Chamber Drying',120,'Energy cycle',1),
(26,3,'Foam Cutting & Upholstery Fabric Fitting',50,'Foam m2 + Fabric m2',2),
(27,3,'Final Hardware Assembly (Handles, Felt Pads)',20,'Hardware kit',1),
(28,3,'Ergonomic & Cosmetic Final QC',20,'QC checklist',1),
(29,3,'Protective Eco-Packaging',25,'Carton + wrap',1),
(30,3,'Finished Goods Warehouse Staging',15,'Pallet',1);

insert into process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_material, standard_qty)
select c.id, m.step_order, m.atelier_id, m.step_name, m.est, m.mat, m.qty
from product_categories c cross join master_steps m
on conflict (category_id, step_order) do nothing;
