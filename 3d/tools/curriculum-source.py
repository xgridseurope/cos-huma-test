# Source of truth for COS-HUMA knowledge data, checked against the textbook photos of pp.25 and 27
# (Medi, 4t primària, unitat 2; photos supplied 2026-11-08). Writes data/curriculum.json.
# Usage: python3 -I tools/curriculum-source.py data/curriculum.json
# Rule: textbook prose is NOT copied; only the label words (exact spelling, lower case) and short facts.
import json, sys
T = 'textbook'
ZONES = {
 'cap':   {'ca': 'Cap', 'es': 'Cabeza', 'zh': '头部', 'en': 'Head'},
 'tronc': {'ca': 'Tronc', 'es': 'Tronco', 'zh': '躯干', 'en': 'Trunk'},
 'ext':   {'ca': 'Extremitats', 'es': 'Extremidades', 'zh': '四肢', 'en': 'Limbs'},
}
ZONE_FACT = {  # short facts taken from the zone boxes on each page (paraphrased)
 ('esquelet', 'cap'):   {'ca': "Al cap hi ha els ossos del crani i els de la cara.", 'es': 'En la cabeza están los huesos del cráneo y los de la cara.', 'zh': '头部有颅骨和面部的骨头。', 'en': 'The head has the skull bones and the face bones.'},
 ('esquelet', 'tronc'): {'ca': "Al tronc hi ha la columna vertebral, les costelles i l'estern.", 'es': 'En el tronco están la columna vertebral, las costillas y el esternón.', 'zh': '躯干有脊柱、肋骨和胸骨。', 'en': 'The trunk has the spine, the ribs and the sternum.'},
 ('esquelet', 'ext'):   {'ca': 'A les extremitats hi ha ossos llargs i, a les mans i als peus, molts ossos petits.', 'es': 'En las extremidades hay huesos largos y, en manos y pies, muchos huesos pequeños.', 'zh': '四肢有长骨；手和脚上有很多小骨头。', 'en': 'The limbs have long bones, and the hands and feet have many small bones.'},
 ('musculatura', 'cap'):   {'ca': 'Músculs plans i anulars: els fem servir per parlar, mastegar i gesticular.', 'es': 'Músculos planos y anulares: sirven para hablar, masticar y gesticular.', 'zh': '扁平肌和环形肌：用来说话、咀嚼和做表情。', 'en': 'Flat and ring-shaped muscles: we use them to talk, chew and make faces.'},
 ('musculatura', 'tronc'): {'ca': "Músculs grans i plans: mantenen dreta la columna, protegeixen l'abdomen i ajuden a respirar.", 'es': 'Músculos grandes y planos: mantienen recta la columna, protegen el abdomen y ayudan a respirar.', 'zh': '大而扁的肌肉：让脊柱挺直、保护腹部、帮助呼吸。', 'en': 'Big flat muscles: keep the spine straight, protect the belly and help us breathe.'},
 ('musculatura', 'ext'):   {'ca': 'Molts són llargs: mouen els braços, les cames, les mans i els peus.', 'es': 'Muchos son largos: mueven brazos, piernas, manos y pies.', 'zh': '很多是长肌：让手臂、腿、手和脚动起来。', 'en': 'Many are long: they move the arms, legs, hands and feet.'},
}
# key, term (same term = same answer), ca label exactly as printed, es, zh, en, zone (label colour), labels on page
BONES = [
 ('crani', 'crani', 'crani', 'cráneo', '颅骨', 'skull', 'cap', 1),
 ('maxillar', 'maxillar', 'maxil·lar', 'maxilar', '下颌骨', 'jawbone', 'cap', 1),
 ('costella', 'costella', 'costella', 'costilla', '肋骨', 'rib', 'tronc', 1),
 ('estern', 'estern', 'estern', 'esternón', '胸骨', 'sternum', 'tronc', 1),
 ('vertebra', 'vertebra', 'vèrtebra', 'vértebra', '椎骨', 'vertebra', 'tronc', 1),
 ('columna', 'columna', 'columna vertebral', 'columna vertebral', '脊柱', 'spine', 'tronc', 1),
 ('pelvis', 'pelvis', 'pelvis', 'pelvis', '骨盆', 'pelvis', 'tronc', 1),
 ('omoplat', 'omoplat', 'omòplat', 'omóplato', '肩胛骨', 'shoulder blade', 'tronc', 1),
 ('humer', 'humer', 'húmer', 'húmero', '肱骨', 'humerus', 'ext', 1),
 ('cubit', 'cubit', 'cúbit', 'cúbito', '尺骨', 'ulna', 'ext', 1),
 ('radi', 'radi', 'radi', 'radio', '桡骨', 'radius', 'ext', 1),
 ('carp', 'carp', 'carp', 'carpo', '腕骨', 'carpals', 'ext', 1),
 ('metacarp', 'metacarp', 'metacarp', 'metacarpo', '掌骨', 'metacarpals', 'ext', 1),
 ('falma', 'falanges', 'falanges', 'falanges', '指骨/趾骨', 'phalanges', 'ext', 1),
 ('femur', 'femur', 'fèmur', 'fémur', '股骨', 'femur', 'ext', 1),
 ('rotula', 'rotula', 'ròtula', 'rótula', '髌骨', 'kneecap', 'ext', 1),
 ('tibia', 'tibia', 'tíbia', 'tibia', '胫骨', 'tibia', 'ext', 1),
 ('perone', 'perone', 'peroné', 'peroné', '腓骨', 'fibula', 'ext', 1),
 ('tars', 'tars', 'tars', 'tarso', '跗骨', 'tarsals', 'ext', 1),
 ('metatars', 'metatars', 'metatars', 'metatarso', '跖骨', 'metatarsals', 'ext', 1),
 ('fpeu', 'falanges', 'falanges', 'falanges', '指骨/趾骨', 'phalanges', 'ext', 1),
]
MUSCLES = [
 ('orbic', 'orbicular de les parpelles', 'orbicular de los párpados', '眼轮匝肌', 'orbicularis oculi', 'cap'),
 ('masseter', 'masseter', 'masetero', '咬肌', 'masseter', 'cap'),
 ('ecm', 'esternoclidomastoidal', 'esternocleidomastoideo', '胸锁乳突肌', 'sternocleidomastoid', 'tronc'),
 ('deltoide', 'deltoide', 'deltoides', '三角肌', 'deltoid', 'tronc'),
 ('pectoral', 'pectoral', 'pectoral', '胸大肌', 'pectoral', 'tronc'),
 ('abdominal', 'abdominal', 'abdominal', '腹肌', 'abdominal', 'tronc'),
 ('dorsal', 'dorsal', 'dorsal', '背阔肌', 'latissimus (back)', 'tronc'),
 ('trapezi', 'trapezi', 'trapecio', '斜方肌', 'trapezius', 'tronc'),
 ('gluti', 'gluti', 'glúteo', '臀肌', 'gluteus', 'tronc'),
 ('biceps', 'bíceps', 'bíceps', '肱二头肌', 'biceps', 'ext'),
 ('triceps', 'tríceps', 'tríceps', '肱三头肌', 'triceps', 'ext'),
 ('quadriceps', 'quàdriceps', 'cuádriceps', '股四头肌', 'quadriceps', 'ext'),
 ('bfem', 'bíceps femoral', 'bíceps femoral', '股二头肌', 'biceps femoris', 'ext'),
 ('tibial', 'tibial', 'tibial', '胫骨前肌', 'tibialis', 'ext'),
 ('besso', 'bessó', 'gemelo', '腓肠肌', 'calf muscle', 'ext'),
]
FACT = {  # item facts stated in the textbook text (paraphrased, short)
 'crani':    {'ca': 'Els ossos del crani són plans i protegeixen el cervell.', 'es': 'Los huesos del cráneo son planos y protegen el cerebro.', 'zh': '颅骨是扁骨，保护大脑。', 'en': 'The skull bones are flat and protect the brain.'},
 'columna':  {'ca': 'Està formada per les vèrtebres i protegeix la medul·la espinal.', 'es': 'Está formada por las vértebras y protege la médula espinal.', 'zh': '由椎骨组成，保护脊髓。', 'en': 'It is made of vertebrae and protects the spinal cord.'},
 'vertebra': {'ca': 'Les vèrtebres formen la columna vertebral.', 'es': 'Las vértebras forman la columna vertebral.', 'zh': '一节节椎骨组成脊柱。', 'en': 'Vertebrae make up the spine.'},
 'costella': {'ca': "Les costelles, l'estern i la columna vertebral protegeixen el cor i els pulmons.", 'es': 'Las costillas, el esternón y la columna protegen el corazón y los pulmones.', 'zh': '肋骨、胸骨和脊柱保护心脏和肺。', 'en': 'The ribs, sternum and spine protect the heart and lungs.'},
 'estern':   {'ca': "Les costelles, l'estern i la columna vertebral protegeixen el cor i els pulmons.", 'es': 'Las costillas, el esternón y la columna protegen el corazón y los pulmones.', 'zh': '肋骨、胸骨和脊柱保护心脏和肺。', 'en': 'The ribs, sternum and spine protect the heart and lungs.'},
 'humer':    {'ca': "L'húmer és un os llarg.", 'es': 'El húmero es un hueso largo.', 'zh': '肱骨是长骨。', 'en': 'The humerus is a long bone.'},
 'femur':    {'ca': 'El fèmur és un os llarg.', 'es': 'El fémur es un hueso largo.', 'zh': '股骨是长骨。', 'en': 'The femur is a long bone.'},
 'falanges': {'ca': 'Les falanges són ossos petits de les mans i dels peus.', 'es': 'Las falanges son huesos pequeños de manos y pies.', 'zh': '指骨和趾骨是手和脚上的小骨头。', 'en': 'Phalanges are small bones of the hands and feet.'},
 'biceps':   {'ca': 'Quan dobleguem el braç, el bíceps es contreu.', 'es': 'Al doblar el brazo, el bíceps se contrae.', 'zh': '弯曲手臂时，肱二头肌收缩。', 'en': 'When we bend the arm, the biceps contracts.'},
 'triceps':  {'ca': 'Quan estirem el braç, el tríceps es contreu.', 'es': 'Al estirar el brazo, el tríceps se contrae.', 'zh': '伸直手臂时，肱三头肌收缩。', 'en': 'When we straighten the arm, the triceps contracts.'},
}
TYPE = {'crani': 'pla', 'humer': 'llarg', 'femur': 'llarg'}  # only types the textbook states
CLASSIFICA = ['falanges', 'pelvis', 'crani', 'omoplat', 'perone', 'maxillar', 'estern', 'humer', 'tars', 'rotula', 'carp']  # activity 2, p.25
OBSERVA_TIPUS = ['omoplat', 'radi', 'maxillar', 'falanges', 'vertebra', 'tibia']  # p.25, answers not printed in the book

items = []
for key, term, ca, es, zh, en, zone, n in BONES:
    items.append({'key': key, 'term': term, 'lesson': 'esquelet', 'page': 25, 'exam': True, 'zone': zone,
        'name': {'ca': ca, 'es': es, 'zh': zh, 'en': en}, 'fact': FACT.get(term), 'type': TYPE.get(term),
        'partOf': 'columna' if key == 'vertebra' else None,
        'inActivity': {'classifica': term in CLASSIFICA, 'observaTipus': term in OBSERVA_TIPUS},
        'status': {'name': T, 'zone': T, 'fact': T if term in FACT else 'none', 'type': T if term in TYPE else 'pending', 'translations': 'pending'}})
for key, ca, es, zh, en, zone in MUSCLES:
    items.append({'key': key, 'term': key, 'lesson': 'musculatura', 'page': 27, 'exam': True, 'zone': zone,
        'name': {'ca': ca, 'es': es, 'zh': zh, 'en': en}, 'fact': FACT.get(key), 'type': None, 'partOf': None,
        'inActivity': {}, 'status': {'name': T, 'zone': T, 'fact': T if key in FACT else 'none', 'type': 'n/a', 'translations': 'pending'}})
for key, ca, es, zh, en in [('clavicula', 'clavícula', 'clavícula', '锁骨', 'collarbone'), ('altres', 'altres ossos', 'otros huesos', '其他骨', 'other bones')]:
    items.append({'key': key, 'term': key, 'lesson': 'esquelet', 'page': None, 'exam': False, 'zone': None, 'name': {'ca': ca, 'es': es, 'zh': zh, 'en': en},
        'fact': None, 'type': None, 'partOf': None, 'inActivity': {}, 'status': {'name': 'not-in-textbook'}})
out = {
 'version': '1.0', 'source': 'Medi 4t primària, unitat 2, p.25 L\'esquelet i p.27 La musculatura (photos 2026-11-08)',
 'statusLegend': {'textbook': 'read from the textbook photos: exact spelling and lower case as printed; zone from label colour',
    'pending': 'not stated in the textbook; never used in exercises', 'none': 'the textbook gives no item fact; the zone fact is shown',
    'not-in-textbook': 'extra shown in 3D only; never labelled or used in exercises'},
 'exerciseRule': 'exercises use only exam=true items and fields whose status is textbook; items sharing a term (falanges) are the same answer',
 'zones': ZONES, 'zoneFacts': {f'{l}.{z}': v for (l, z), v in ZONE_FACT.items()},
 'types': {'llarg': {'ca': 'os llarg', 'es': 'hueso largo', 'zh': '长骨', 'en': 'long bone'}, 'pla': {'ca': 'os pla', 'es': 'hueso plano', 'zh': '扁骨', 'en': 'flat bone'}},
 'items': items}
json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
print(len([i for i in items if i['exam']]), 'exam items;', len({(i['lesson'], i['term']) for i in items if i['exam']}), 'distinct terms')
