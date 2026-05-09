import bpy
import math
import os

def generate():
    # Очищуємо сцену повністю
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Матеріали (їх назви будуть використані в React Three Fiber)
    mat_titanium = bpy.data.materials.new(name="Titanium")
    mat_carbon = bpy.data.materials.new(name="Carbon")
    mat_inner = bpy.data.materials.new(name="InnerMetal")

    # 1. Основна внутрішня труба (Титан)
    # Зробимо її довшою, щоб було видно частину до насадки
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.9, depth=5.0, location=(0, 0, 0))
    pipe = bpy.context.active_object
    pipe.name = "TitaniumPipe"
    pipe.data.materials.append(mat_titanium)
    pipe.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.shade_smooth()
    
    # 2. Карбонова насадка (Outer sleeve)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1.05, depth=2.0, location=(0, 1.5, 0))
    tip = bpy.context.active_object
    tip.name = "CarbonTip"
    tip.data.materials.append(mat_carbon)
    tip.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.shade_smooth()

    # Зріз під кутом (характерна риса Akrapovic)
    # Зрізаємо карбонову насадку
    bpy.ops.mesh.primitive_cube_add(size=4, location=(0, 3.0, 0.6))
    cutter = bpy.context.active_object
    cutter.rotation_euler = (math.radians(25), 0, 0)
    
    mod_bool_tip = tip.modifiers.new(name="Boolean", type='BOOLEAN')
    mod_bool_tip.operation = 'DIFFERENCE'
    mod_bool_tip.object = cutter
    bpy.context.view_layer.objects.active = tip
    bpy.ops.object.modifier_apply(modifier="Boolean")

    # Зрізаємо титанову трубу
    mod_bool_pipe = pipe.modifiers.new(name="Boolean", type='BOOLEAN')
    mod_bool_pipe.operation = 'DIFFERENCE'
    mod_bool_pipe.object = cutter
    bpy.context.view_layer.objects.active = pipe
    bpy.ops.object.modifier_apply(modifier="Boolean")
    
    # Видаляємо різак
    bpy.data.objects.remove(cutter)

    # 3. Товщина стінок (Solidify)
    # Для титанової труби
    mod_sol_pipe = pipe.modifiers.new("Solidify", 'SOLIDIFY')
    mod_sol_pipe.thickness = 0.05
    mod_sol_pipe.offset = -1
    bpy.context.view_layer.objects.active = pipe
    bpy.ops.object.modifier_apply(modifier="Solidify")

    # Для карбонової насадки
    mod_sol_tip = tip.modifiers.new("Solidify", 'SOLIDIFY')
    mod_sol_tip.thickness = 0.04
    mod_sol_tip.offset = -1
    bpy.context.view_layer.objects.active = tip
    bpy.ops.object.modifier_apply(modifier="Solidify")

    # 4. Внутрішня перфорована серцевина (темна)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.8, depth=4.8, location=(0, -0.2, 0))
    core = bpy.context.active_object
    core.name = "PerforatedCore"
    core.data.materials.append(mat_inner)
    core.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.shade_smooth()

    # 5. Зварні шви (Weld rings)
    # Зварний шов біля початку карбонової насадки
    bpy.ops.mesh.primitive_torus_add(major_radius=0.9, minor_radius=0.03, major_segments=64, minor_segments=16, location=(0, 0.5, 0))
    weld = bpy.context.active_object
    weld.name = "WeldRing"
    weld.data.materials.append(mat_titanium)
    weld.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.shade_smooth()

    # Зварний шов трохи далі на трубі
    bpy.ops.mesh.primitive_torus_add(major_radius=0.9, minor_radius=0.03, major_segments=64, minor_segments=16, location=(0, -1.0, 0))
    weld2 = bpy.context.active_object
    weld2.name = "WeldRing2"
    weld2.data.materials.append(mat_titanium)
    weld2.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.shade_smooth()

    # Повертаємо всі об'єкти так, щоб вони горизонтально виходили на користувача 
    # для WebGL (базове розташування)
    bpy.ops.object.select_all(action='SELECT')
    # Масштабуємо трохи
    bpy.ops.transform.resize(value=(0.5, 0.5, 0.5))

    # Шлях експорту
    export_path = r"D:\OneCompany\public\3d\akrapovic_exhaust.glb"
    os.makedirs(os.path.dirname(export_path), exist_ok=True)

    # Експорт у .GLB
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    return f"Model generated and exported to {export_path}"

try:
    result = generate()
    print(result)
except Exception as e:
    import traceback
    print("ERROR:", traceback.format_exc())
