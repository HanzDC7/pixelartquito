'use strict';

/*
 * Dónde está cada lugar con ficha: metros desde la Plaza Grande, en el sistema
 * del mapa (x hacia el norte de la cuadrícula del centro, y hacia el oriente).
 * Las posiciones salen de OpenStreetMap.
 *
 *   r      radio que responde al clic, en metros
 *   nivel  hasta qué alejamiento se muestra: 3 siempre, 2 hasta «ciudad», 1 solo de cerca
 *
 * El orden es de importancia: cuando dos nombres no caben, gana el primero.
 */
Q.SITIOS = [
    { id: 'plaza', n: 'Plaza Grande', x: 0, y: 0, r: 46, nivel: 3 },
    { id: 'mitad', n: 'Mitad del Mundo', x: 22270, y: -11134, r: 150, nivel: 3 },
    { id: 'rucu', n: 'Rucu Pichincha', x: 782, y: -8755, r: 700, nivel: 3 },
    { id: 'panecillo', n: 'El Panecillo', x: -1203, y: 92, r: 130, nivel: 3 },
    { id: 'carolina', n: 'La Carolina', x: 5046, y: -343, r: 330, nivel: 3 },
    { id: 'quitumbe', n: 'Quitumbe', x: -9538, y: 1788, r: 150, nivel: 3 },
    { id: 'bicentenario', n: 'Bicentenario', x: 8454, y: -3895, r: 420, nivel: 3 },
    { id: 'teleferico', n: 'TelefériQo', x: 1380, y: -3560, r: 330, nivel: 3 },
    { id: 'pululahua', n: 'Pululahua', x: 22500, y: -17300, r: 1500, nivel: 3 },
    { id: 'basilica', n: 'Basílica', x: 797, y: 5, r: 75, nivel: 2 },
    { id: 'sanfrancisco', n: 'San Francisco', x: -262, y: -239, r: 85, nivel: 2 },
    { id: 'metropolitano', n: 'Parque Metropolitano', x: 7014, y: 1204, r: 600, nivel: 3 },
    { id: 'ejido', n: 'El Ejido', x: 1921, y: 345, r: 190, nivel: 2 },
    { id: 'estadio', n: 'Estadio Atahualpa', x: 6154, y: -136, r: 110, nivel: 2 },
    { id: 'itchimbia', n: 'Itchimbía', x: 767, y: 855, r: 130, nivel: 2 },
    { id: 'alameda', n: 'La Alameda', x: 1087, y: 426, r: 120, nivel: 2 },
    { id: 'chimbacalle', n: 'Chimbacalle', x: -1731, y: 1058, r: 90, nivel: 2 },
    { id: 'solanda', n: 'Solanda', x: -5932, y: 1100, r: 260, nivel: 2 },
    { id: 'chillogallo', n: 'Chillogallo', x: -8724, y: -652, r: 150, nivel: 2 },
    { id: 'casablanca', n: 'Casa Blanca', x: 10991, y: -6323, r: 120, nivel: 2 },
    { id: 'cotocollao', n: 'Cotocollao', x: 9763, y: -6528, r: 130, nivel: 2 },
    { id: 'cima', n: 'Cima de la Libertad', x: -1034, y: -1340, r: 100, nivel: 2 },
    { id: 'guapulo', n: 'Guápulo', x: 4362, y: 1626, r: 90, nivel: 2 },
    { id: 'capilla', n: 'Capilla del Hombre', x: 5562, y: 1443, r: 70, nivel: 2 },
    { id: 'universidad', n: 'Universidad Central', x: 2260, y: -1000, r: 230, nivel: 2 },
    { id: 'recreo', n: 'El Recreo', x: -3520, y: 1560, r: 140, nivel: 2 },
    { id: 'magdalena', n: 'La Magdalena', x: -2988, y: 188, r: 90, nivel: 2 },
    { id: 'cuadras', n: 'Las Cuadras', x: -8200, y: 1860, r: 230, nivel: 2 },
    { id: 'plazatoros', n: 'Plaza de Toros', x: 6738, y: -1836, r: 80, nivel: 2 },
    { id: 'mariscal', n: 'Plaza Foch', x: 2974, y: 512, r: 70, nivel: 2 },
    { id: 'casacultura', n: 'Casa de la Cultura', x: 2114, y: 676, r: 75, nivel: 1 },
    { id: 'carondelet', n: 'Carondelet', x: -3, y: -76, r: 34, nivel: 1 },
    { id: 'catedral', n: 'Catedral', x: -61, y: -4, r: 30, nivel: 1 },
    { id: 'compania', n: 'La Compañía', x: -179, y: -97, r: 34, nivel: 1 },
    { id: 'santodomingo', n: 'Santo Domingo', x: -379, y: 270, r: 60, nivel: 1 },
    { id: 'merced', n: 'La Merced', x: 55, y: -290, r: 42, nivel: 1 },
    { id: 'sanagustin', n: 'San Agustín', x: 86, y: 172, r: 42, nivel: 1 },
    { id: 'ronda', n: 'La Ronda', x: -516, y: 284, r: 46, nivel: 1 },
    { id: 'museociudad', n: 'Museo de la Ciudad', x: -460, y: -28, r: 44, nivel: 1 },
    { id: 'teatrosucre', n: 'Teatro Sucre', x: 311, y: 196, r: 44, nivel: 1 },
];

// Los nevados que quedan fuera del mapa: se señalan en el borde, con su rumbo y su distancia.
Q.LEJANOS = [
    { n: 'Cotopaxi', ele: 5897, x: -33134, y: 40004 },
    { n: 'Cayambe', ele: 5790, x: 59270, y: 25993 },
    { n: 'Antisana', ele: 5753, x: 5445, y: 50090 },
    { n: 'Ilinizas', ele: 5248, x: -51337, y: 14992 },
];

/*
 * Hitos: lo que hace reconocible a cada lugar desde lejos, con su medida real.
 * Los contornos de los edificios ya vienen de los datos; aquí se les da su
 * altura y sus materiales, y se añaden torres, cúpulas y monumentos.
 *
 *   r: [x, y]            repinta el edificio que está en ese punto
 *   c: [x0, y0, x1, y1]  añade un cuerpo rectangular (una torre)
 *   d: [x, y, radio]     añade un cuerpo redondo (una cúpula, una estatua)
 *   alto, en metros · techo, el color visto desde arriba · muro, el material (ver MURO en pinta.js)
 *   punta: cuántos de esos metros son aguja (el cuerpo se afina hacia el centro)
 *
 * Las alturas de la Basílica, la Virgen, La Merced y la Mitad del Mundo son las
 * publicadas; las demás torres y cúpulas están estimadas a ojo.
 */
Q.HITOS = [
    // Basílica del Voto Nacional: nave de 30 m, torres de 115 m y aguja del crucero de 74 m
    { r: [797, 5], techo: '#4A5560', muro: 19, alto: 30 },
    { c: [739, -8, 750, 3], techo: '#3F4A52', muro: 19, alto: 115, punta: 40 },
    { c: [739, 17, 750, 28], techo: '#3F4A52', muro: 19, alto: 115, punta: 40 },
    { c: [855, -1, 862, 7], techo: '#3F4A52', muro: 19, alto: 74, punta: 30 },
    // Virgen de El Panecillo: 30 m de aluminio sobre una base de 11 m
    { r: [-1203, 92], techo: '#C9C3B6', muro: 19, alto: 11 },
    { d: [-1202.5, 91.5, 2.6], techo: '#E3E8EF', muro: 22, alto: 41 },
    // Plaza Grande: el Monumento a la Independencia
    { d: [0, 0, 4.5], techo: '#C9C3B6', muro: 19, alto: 2 },
    { c: [-1.5, -1.5, 1.5, 1.5], techo: '#E8E4DA', muro: 1, alto: 17 },
    // Catedral: la torre junto a García Moreno y las cúpulas de teja verde
    { r: [-61, -4], muro: 1, alto: 14, teja: true },
    { c: [-66, -47, -58, -39], techo: '#4E9A6A', muro: 1, alto: 34 },
    { d: [-57, 22, 4.5], techo: '#4E9A6A', muro: 1, alto: 20 },
    // El Sagrario
    { r: [-89, -17], muro: 19, alto: 14, teja: true },
    { d: [-90, -18, 6], techo: '#4E9A6A', muro: 19, alto: 24 },
    // Carondelet
    { r: [-3, -76], muro: 1, alto: 15, teja: true },
    // La Compañía: piedra gris y cúpulas verdes
    { r: [-179, -97], techo: '#8E8A86', muro: 19, alto: 22 },
    { d: [-184, -118, 7], techo: '#3E8E5A', muro: 19, alto: 34 },
    { d: [-184, -93, 4], techo: '#3E8E5A', muro: 19, alto: 27 },
    // San Francisco: las dos torres de la fachada, hacia la plaza
    { r: [-262, -239], muro: 1, alto: 18, teja: true },
    { c: [-268, -232, -261, -225], techo: '#D9D4C6', muro: 1, alto: 40, punta: 8 },
    { c: [-248, -236, -241, -229], techo: '#D9D4C6', muro: 1, alto: 40, punta: 8 },
    // La Merced: la torre de 47 m y sus cúpulas blancas
    { r: [55, -290], techo: '#E8E4DA', muro: 1, alto: 16 },
    { c: [29, -327, 37, -319], techo: '#D9D4C6', muro: 1, alto: 47, punta: 10 },
    { d: [46, -300, 5], techo: '#F4F1E8', muro: 1, alto: 26 },
    { d: [46, -275, 4], techo: '#F4F1E8', muro: 1, alto: 22 },
    // Santo Domingo y San Agustín
    { r: [-379, 270], muro: 1, alto: 16, teja: true },
    { c: [-364, 239, -357, 246], techo: '#4E9A6A', muro: 1, alto: 38 },
    { r: [86, 172], muro: 1, alto: 15, teja: true },
    { c: [71, 147, 78, 154], techo: '#D9D4C6', muro: 1, alto: 37 },
    // Teatro Sucre, Palacio de Cristal y Casa de la Cultura
    { r: [311, 196], techo: '#9AA0AC', muro: 1, alto: 18 },
    { r: [767, 855], techo: '#BFE3F0', muro: 15, alto: 14 },
    { r: [2060, 680], techo: '#7FA6B8', muro: 16, alto: 22 },
    // Mitad del Mundo: 30 m de piedra con el globo de bronce encima
    { r: [22270, -11134], techo: '#A8A193', muro: 19, alto: 26 },
    { d: [22270, -11134, 2.6], techo: '#C8A24A', muro: 23, alto: 30 },
];

// La Virgen de El Panecillo se dibuja aparte en la vista inclinada: una columna no tiene alas.
Q.VIRGEN = {
    x: -1202.5, y: 91.5, base: 11, alto: 30,
    forma: ['....y.y.y....', '.....AAa.....', '.a...AAa...a.', '.Aa..AAa..Aa.', '.AAa.AAa.AAa.', '..AAaAAaAAa..', '...AAAAAAa...', '....AAAAa....', '....AAAAa....', '....AAAaa....', '...AAAAaa....', '...AAAAAaa...', '...AAAAAaa...', '....sAAas....', '...sssssss...'],
    color: { A: '#E3E8EF', a: '#AEB8C6', s: '#8A95A5', y: '#FFE9A8' },
};
