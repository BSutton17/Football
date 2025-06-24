export const catchBall = (openness, qbPenalty) =>{
    const catchRate = Math.random() * (100 - 1) + 1
    console.log("catchRate: " + catchRate)
    switch(openness + qbPenalty){
        case "lime":
            if(catchRate < 96){
                return "Caught"
            }
            else{
                return "Dropped"
            }
        case "yellow":
            if(catchRate < 50){
                return "Caught"
            }
            else if(catchRate >= 51 && catchRate < 95){
                return "Broken Up"
            }
            else {
                return "Intercepted"
            }
        case "red":
            if(catchRate < 25){
                return "Caught"
            }
            else if(catchRate >= 26 && catchRate < 75){
                return "Broken Up"
            }
            else {
                return "Intercepted"
            }
    }
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
}