import { Box, Text } from "@chakra-ui/react";

interface CollaboratorsPieProps {
  collab: string[];
  percent: number[];
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#8dd1e1', '#a4de6c', '#d0ed57', '#ffc0cb'
];

const CollaboratorsPie: React.FC<CollaboratorsPieProps> = ({ collab, percent }) => {
  if (!collab || !percent || collab.length !== percent.length) return null;

  // Calcul des pourcentages cumulés pour conic-gradient
  let cumulative = 0;
  const gradients = percent.map((p, i) => {
    const start = cumulative;
    cumulative += p;
    const color = COLORS[i % COLORS.length];
    return `${color} ${start}% ${cumulative}%`;
  });

  return (
    <Box mt={6} textAlign="center">
      <Text mb={4} fontWeight="bold" color="gray.200">
        Collaborateurs et parts (%)
      </Text>

      <Box
        width="200px"
        height="200px"
        borderRadius="50%"
        bg={`conic-gradient(${gradients.join(', ')})`}
        mx="auto"
        position="relative"
      >
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          width="100px"
          height="100px"
          borderRadius="50%"
          bg="blackAlpha.800"
        />
      </Box>

      <Box mt={4}>
        {collab.map((c, i) => (
          <Text key={i} color={COLORS[i % COLORS.length]} fontSize="sm">
            {c} — {percent[i]}%
          </Text>
        ))}
      </Box>
    </Box>
  );
};

export default CollaboratorsPie;
