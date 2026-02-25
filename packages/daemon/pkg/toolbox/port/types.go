package port

type PortList struct {
	Ports []uint `json:"ports"`
} //	@name	PortList

type IsPortInUseResponse struct {
	IsInUse bool `json:"isInUse"`
} //	@name	IsPortInUseResponse
