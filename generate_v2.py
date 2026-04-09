import bpy
import bmesh
import math
import os

def generate_v2():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    
    mat_carbon = bpy.data.materials.new("Carbon")
    mat_titanium = bpy.data.materials.new("Titanium")
    mat_dark = bpy.data.materials.new("InnerMetal")

    # --- Muffler Body (Титанова банка) ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=1.0, depth=4.0, location=(0, 0, 0))
    body = bpy.context.active_object
    body.name = "MufflerBody"
    body.data.materials.append(mat_titanium)
    
    body.scale = (0.7, 1.0, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    mod_bevel = body.modifiers.new("Bevel", 'BEVEL')
    mod_bevel.width = 0.25
    mod_bevel.segments = 8
    mod_bevel.profile = 0.5
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier="Bevel")
    bpy.ops.object.shade_smooth()

    # --- Carbon End Cap (Карбоновий накінечник) ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.99, depth=1.5, location=(0, 0, 2.5))
    cap = bpy.context.active_object
    cap.name = "CarbonEndCap"
    cap.data.materials.append(mat_carbon)
    cap.scale = (0.7, 1.0, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    mod_cap_bevel = cap.modifiers.new("Bevel", 'BEVEL')
    mod_cap_bevel.width = 0.25
    mod_cap_bevel.segments = 8
    mod_cap_bevel.profile = 0.5
    bpy.context.view_layer.objects.active = cap
    bpy.ops.object.modifier_apply(modifier="Bevel")

    bpy.ops.mesh.primitive_cube_add(size=4, location=(0, -0.6, 3.2))
    cutter = bpy.context.active_object
    cutter.rotation_euler = (math.radians(35), 0, 0)
    
    cap_bool = cap.modifiers.new("Boolean", 'BOOLEAN')
    cap_bool.operation = 'DIFFERENCE'
    cap_bool.object = cutter
    bpy.context.view_layer.objects.active = cap
    bpy.ops.object.modifier_apply(modifier="Boolean")
    
    body_bool = body.modifiers.new("Boolean", 'BOOLEAN')
    body_bool.operation = 'DIFFERENCE'
    body_bool.object = cutter
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier="Boolean")
    
    bpy.data.objects.remove(cutter)
    
    cap_solid = cap.modifiers.new("Solidify", 'SOLIDIFY')
    cap_solid.thickness = 0.08
    cap_solid.offset = -1
    bpy.context.view_layer.objects.active = cap
    bpy.ops.object.modifier_apply(modifier="Solidify")
    bpy.ops.object.shade_smooth()

    # --- Dual Inner Pipes (Внутрішні подвійні трубки Akrapovic) ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.28, depth=1.5, location=(0, 0.4, 2.4))
    pipe1 = bpy.context.active_object
    pipe1.name = "InnerPipe1"
    pipe1.data.materials.append(mat_titanium)
    
    bpy.ops.mesh.primitive_cube_add(size=2, location=(0, -0.5, 3.0))
    pcut = bpy.context.active_object
    pcut.rotation_euler = (math.radians(35), 0, 0)
    
    p1_bool = pipe1.modifiers.new("Boolean", 'BOOLEAN')
    p1_bool.operation = 'DIFFERENCE'
    p1_bool.object = pcut
    bpy.context.view_layer.objects.active = pipe1
    bpy.ops.object.modifier_apply(modifier="Boolean")
    
    p1_solid = pipe1.modifiers.new("Solidify", 'SOLIDIFY')
    p1_solid.thickness = 0.04
    p1_solid.offset = -1
    bpy.context.view_layer.objects.active = pipe1
    bpy.ops.object.modifier_apply(modifier="Solidify")
    bpy.ops.object.shade_smooth()

    bpy.ops.object.duplicate(linked=False)
    pipe2 = bpy.context.active_object
    pipe2.name = "InnerPipe2"
    pipe2.location = (0, -0.4, 2.4) 
    bpy.data.objects.remove(pcut)

    # --- Inner background ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.9, depth=0.1, location=(0, 0, 1.8))
    dark = bpy.context.active_object
    dark.name = "DarkCore"
    dark.data.materials.append(mat_dark)
    dark.scale = (0.7, 1.0, 1.0)
    bpy.ops.object.shade_smooth()
    
    # --- Inlet Pipe ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.35, depth=1.5, location=(0, 0, -2.5))
    inlet = bpy.context.active_object
    inlet.name = "InletPipe"
    inlet.data.materials.append(mat_titanium)
    bpy.ops.object.shade_smooth()
    
    bpy.ops.mesh.primitive_torus_add(major_radius=0.45, minor_radius=0.03, major_segments=64, minor_segments=16, location=(0, 0, -2.0))
    weld = bpy.context.active_object
    weld.name = "WeldRingInlet"
    weld.data.materials.append(mat_titanium)
    bpy.ops.object.shade_smooth()

    bpy.ops.mesh.primitive_torus_add(major_radius=0.85, minor_radius=0.04, major_segments=64, minor_segments=16, location=(0, 0, 1.6))
    weld2 = bpy.context.active_object
    weld2.name = "WeldRingCap"
    weld2.scale = (0.72, 1.01, 1.0)
    weld2.data.materials.append(mat_titanium)
    bpy.ops.object.shade_smooth()

    # --- Rotation ---
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.transform.rotate(value=math.radians(90), orient_axis='X')
    bpy.ops.transform.rotate(value=math.radians(15), orient_axis='Z') 
    bpy.ops.transform.resize(value=(0.4, 0.4, 0.4))
    
    export_path = r"D:\OneCompany\public\3d\akrapovic_v2.glb"
    os.makedirs(os.path.dirname(export_path), exist_ok=True)

    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    return export_path

try:
    generate_v2()
    print("SUCCESS_V2")
except Exception as e:
    import traceback
    print("ERROR:", traceback.format_exc())
