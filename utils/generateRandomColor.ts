export const generateRandomColor = () => {
    let color;
    do {
      color = `#${Math.floor(Math.random() * 16777215).toString(16)}`;
    } while (
      color.toLowerCase() === "#ffffff" || 
      color.toLowerCase() === "#000000" || 
      color.length < 7 // In case generated hex is too short
    );
    return color;
  };