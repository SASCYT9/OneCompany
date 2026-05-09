import { Frame, Text, Ellipse, Icon } from 'figma-use/render'

export default function GiroDiscHome() {
  return (
    <Frame w={1440} h={1024} bg="#030303" flex="col" overflow="hidden">
      {/* Background gradients */}
      <Frame position="absolute" x={-200} y={-200} w={800} h={800} bg="#c29d59" opacity={0.15} blur={200} rounded={400} />
      <Frame position="absolute" x={800} y={400} w={600} h={600} bg="#c29d59" opacity={0.05} blur={150} rounded={300} />
      
      {/* Navigation */}
      <Frame w="fill" h={80} px={60} flex="row" items="center" justify="between">
        {/* Logo area */}
        <Frame flex="row" gap={12} items="center">
          <Icon name="mdi:record-circle" size={32} color="#c29d59" />
          <Text font="Inter" size={24} weight="bold" color="#FFF" letterSpacing={2}>GIRODISC</Text>
        </Frame>

        {/* Links */}
        <Frame flex="row" gap={40}>
          <Text font="Inter" size={13} weight="bold" color="#FFF" letterSpacing={1}>PRODUCTS</Text>
          <Text font="Inter" size={13} weight="bold" color="#888" letterSpacing={1}>TECHNOLOGY</Text>
          <Text font="Inter" size={13} weight="bold" color="#888" letterSpacing={1}>SUPPORT</Text>
          <Text font="Inter" size={13} weight="bold" color="#888" letterSpacing={1}>ABOUT</Text>
        </Frame>

        {/* Actions */}
        <Frame flex="row" gap={24} items="center">
          <Icon name="lucide:search" size={20} color="#FFF" />
          <Icon name="lucide:shopping-bag" size={20} color="#FFF" />
        </Frame>
      </Frame>

      {/* Hero */}
      <Frame w="fill" grow={1} flex="row" px={60} py={80} items="center" justify="between">
        
        {/* Left Typography */}
        <Frame w={640} flex="col" gap={32}>
          <Frame flex="col" gap={16}>
            <Text font="Inter" size={14} weight="bold" color="#c29d59" letterSpacing={5}>
              UNCOMPROMISING PERFORMANCE
            </Text>
            <Text font="Inter" size={72} weight="bold" color="#FFF" lineHeight={1.1} letterSpacing={-2}>
              ENGINEERED TO STOP TIME.
            </Text>
            <Text font="Inter" size={16} color="#888" lineHeight={1.6} w={500}>
              Experience the pinnacle of braking technology. Aerospace-grade materials meets race-proven engineering for your street and track applications.
            </Text>
          </Frame>

          {/* CTA Buttons */}
          <Frame flex="row" gap={16}>
            <Frame bg="#c29d59" px={32} py={16} rounded={4}>
              <Text font="Inter" size={13} weight="bold" color="#000" letterSpacing={1}>SHOP ROTORS</Text>
            </Frame>
            <Frame px={32} py={16} rounded={4} strokeColor="#333" strokeWidth={1}>
              <Text font="Inter" size={13} weight="bold" color="#FFF" letterSpacing={1}>FIND YOUR VEHICLE</Text>
            </Frame>
          </Frame>

          {/* Stats Glassmorphism */}
          <Frame mt={40} flex="row" gap={16}>
            <Frame bg="#ffffff08" blur={20} strokeColor="#ffffff10" strokeWidth={1} p={24} rounded={8} flex="col" gap={8} w={180}>
              <Text font="Inter" size={28} weight="bold" color="#c29d59">100%</Text>
              <Text font="Inter" size={11} weight="bold" color="#888" letterSpacing={1}>CNC MACHINED IN USA</Text>
            </Frame>
            <Frame bg="#ffffff08" blur={20} strokeColor="#ffffff10" strokeWidth={1} p={24} rounded={8} flex="col" gap={8} w={180}>
              <Text font="Inter" size={28} weight="bold" color="#c29d59">2-Piece</Text>
              <Text font="Inter" size={11} weight="bold" color="#888" letterSpacing={1}>FLOATING DESIGN</Text>
            </Frame>
            <Frame bg="#ffffff08" blur={20} strokeColor="#ffffff10" strokeWidth={1} p={24} rounded={8} flex="col" gap={8} w={180}>
              <Text font="Inter" size={28} weight="bold" color="#c29d59">72 Vane</Text>
              <Text font="Inter" size={11} weight="bold" color="#888" letterSpacing={1}>CURVED COOLING</Text>
            </Frame>
          </Frame>
        </Frame>

        {/* Right Product Abstract Graphic */}
        <Frame w={600} h={600} position="relative" items="center" justify="center">
          {/* Subtle glow behind rotor */}
          <Frame position="absolute" w={400} h={400} bg="#c29d59" opacity={0.2} blur={120} rounded={200} />
          
          {/* Rotor Abstract Representation */}
          <Ellipse w={480} h={480} strokeColor="#333" strokeWidth={60} position="absolute" />
          <Ellipse w={360} h={360} bg="#080808" strokeColor="#c29d59" strokeWidth={2} position="absolute" />
          <Ellipse w={100} h={100} bg="#000" strokeColor="#222" strokeWidth={4} position="absolute" />
          
          {/* Hub bolts */}
          <Ellipse w={12} h={12} bg="#555" position="absolute" x={294} y={150} />
          <Ellipse w={12} h={12} bg="#555" position="absolute" x={294} y={438} />
          <Ellipse w={12} h={12} bg="#555" position="absolute" x={150} y={294} />
          <Ellipse w={12} h={12} bg="#555" position="absolute" x={438} y={294} />

          <Ellipse w={12} h={12} bg="#555" position="absolute" x={200} y={200} />
          <Ellipse w={12} h={12} bg="#555" position="absolute" x={388} y={388} />
          <Ellipse w={12} h={12} bg="#555" position="absolute" x={388} y={200} />
          <Ellipse w={12} h={12} bg="#555" position="absolute" x={200} y={388} />

          <Text font="Inter" size={18} weight="bold" color="#c29d59" letterSpacing={4} position="absolute" y={220}>GIRODISC</Text>
        </Frame>

      </Frame>
    </Frame>
  )
}
